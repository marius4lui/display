import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDashboardDocument } from "../lib/server/document.ts";
import { assertPublicHttps, dnsAnswersChanged, limitedResponse } from "../lib/server/safe-fetch.ts";
import { normalizeDashboard } from "../lib/dashboard.ts";
import { homeAssistantSourceRequest, oauthRefreshForm, providerActionRequest } from "../lib/server/provider-request.ts";

const style = { background: "#111", foreground: "#fff", accent: "#70f", align: "center" };
const base = {
  schemaVersion: 6,
  name: "Integration Test",
  settings: { configPollSeconds: 30, dataPollSeconds: 60, columns: 12, rows: 8, background: "#000", foreground: "#fff" },
  dataSources: [],
  actions: [],
  pages: [{ id: "page", name: "Seite", widgets: [] }],
  pageNavigation: { visible: false, x: 4, y: 7, width: 4, height: 1, style },
};

test("Schema v6 akzeptiert eine gültige Action mit Button", () => {
  const document = structuredClone(base);
  document.actions.push({
    id: "action-1", name: "Licht", integrationId: "10000000-0000-4000-8000-000000000001",
    provider: "home_assistant", operation: "home_assistant_service",
    target: { domain: "light", service: "turn_on" }, confirmation: true, cooldownMs: 2000, timeoutMs: 20000,
  });
  document.pages[0].widgets.push({ id: "button", type: "button", title: "Licht", actionId: "action-1", x: 0, y: 0, width: 3, height: 2, errorBehavior: "error", style });
  assert.equal(parseDashboardDocument(document).schemaVersion, 6);
});

test("Schema v6 lehnt fremde Button-Actions und überlange Timeouts ab", () => {
  const missing = structuredClone(base);
  missing.pages[0].widgets.push({ id: "button", type: "button", title: "Manipuliert", actionId: "foreign", x: 0, y: 0, width: 3, height: 2, errorBehavior: "error", style });
  assert.throws(() => parseDashboardDocument(missing), /keine vorhandene Action/);

  const timeout = structuredClone(base);
  timeout.actions.push({ id: "action", name: "Webhook", integrationId: "10000000-0000-4000-8000-000000000001", provider: "n8n", operation: "n8n_webhook", target: { webhookPath: "/webhook/live" }, timeoutMs: 20001 });
  assert.throws(() => parseDashboardDocument(timeout), /Timeout/);
});

test("Schema v4 wird verlustfrei auf v6 normalisiert", () => {
  const legacy = { ...structuredClone(base), schemaVersion: 4 };
  const normalized = normalizeDashboard(legacy);
  assert.equal(normalized.schemaVersion, 6);
  assert.deepEqual(normalized.actions, legacy.actions);
  assert.equal(normalized.name, legacy.name);
  assert.deepEqual(normalized.pages, legacy.pages);
});

test("Schema v6 akzeptiert ein Immich-Album-Widget nur mit gültiger Quelle", () => {
  const document = structuredClone(base);
  document.dataSources.push({
    id: "immich-source", name: "Familie", type: "immich", integrationId: "10000000-0000-4000-8000-000000000001",
    resource: "album", albumId: "20000000-0000-4000-8000-000000000002", method: "GET", url: "", headers: {}, auth: { type: "none" },
  });
  document.pages[0].widgets.push({ id: "album", type: "immich_album", title: "Familie", dataSourceId: "immich-source", x: 0, y: 0, width: 6, height: 4, errorBehavior: "stale", style });
  assert.equal(parseDashboardDocument(document).schemaVersion, 6);
  document.pages[0].widgets[0].dataSourceId = "missing";
  assert.throws(() => parseDashboardDocument(document), /keine vorhandene Datenquelle/);
});

test("Schema v6 validiert Custom UI und sichere Bild-URLs", () => {
  const document = structuredClone(base);
  document.customUi = { version: 1, enabled: true, pages: { page: { type: "column", children: [{ type: "text", text: "Hallo" }] } } };
  assert.equal(parseDashboardDocument(document).schemaVersion, 6);
  document.customUi.pages.page.children.push({ type: "image", url: "javascript:alert(1)" });
  assert.throws(() => parseDashboardDocument(document), /sichere Player-/);
});

test("Custom UI darf nur vorhandene Datenquellen und Aktionen binden", () => {
  const document = structuredClone(base);
  document.customUi = { version: 1, enabled: true, pages: { page: { type: "value", sourceId: "missing", path: "value" } } };
  assert.throws(() => parseDashboardDocument(document), /keine vorhandene Datenquelle/);
  document.customUi.pages.page = { type: "button", actionId: "missing" };
  assert.throws(() => parseDashboardDocument(document), /keine vorhandene Aktion/);
});

test("Integrationsziele blockieren HTTP und private IPs", async () => {
  await assert.rejects(assertPublicHttps("http://example.com"), /öffentliche HTTPS/);
  await assert.rejects(assertPublicHttps("https://127.0.0.1"), /Private/);
  await assert.rejects(assertPublicHttps("https://[::1]"), /Private/);
  await assert.rejects(assertPublicHttps("https://example.com", "https://other.example"), /fremden Host/);
});

test("n8n verwendet ausschließlich Production-Webhooks und feste Authentifizierung", () => {
  const request = providerActionRequest("https://n8n.example", {
    provider: "n8n", target: { webhookPath: "/webhook/display-click", method: "POST" }, payload: { fixed: true },
  }, { webhookAuth: "header", headerName: "X-Hook-Key", headerValue: "secret" }, { deviceId: "device-1" });
  assert.equal(request.url, "https://n8n.example/webhook/display-click");
  assert.equal(request.headers["X-Hook-Key"], "secret");
  assert.deepEqual(request.body, { fixed: true, player: { deviceId: "device-1" } });
  assert.throws(() => providerActionRequest("https://n8n.example", { provider: "n8n", target: { webhookPath: "/webhook-test/display" } }, {}, {}), /Production-Webhooks/);
});

test("Home Assistant steuert ausschließlich über Services mit festen Zielen", () => {
  const request = providerActionRequest("https://ha.example", {
    provider: "home_assistant",
    target: { domain: "light", service: "turn_on", selection: { entityId: ["light.kitchen"], deviceId: ["device-1"], areaId: ["living"] } },
    payload: { brightness: 120 }, responseSourceId: "response",
  }, { accessToken: "token" }, {});
  assert.equal(request.url, "https://ha.example/api/services/light/turn_on?return_response");
  assert.doesNotMatch(request.url, /api\/states/);
  assert.equal(request.headers.Authorization, "Bearer token");
  assert.deepEqual(request.body, { brightness: 120, entity_id: ["light.kitchen"], device_id: ["device-1"], area_id: ["living"] });
});

test("Home-Assistant-Anzeigequellen verwenden die vorgesehenen REST-Endpunkte", () => {
  assert.equal(homeAssistantSourceRequest("https://ha.example", { resource: "states", entityIds: ["sensor.room"] }), "https://ha.example/api/states/sensor.room");
  assert.match(homeAssistantSourceRequest("https://ha.example", { resource: "history", entityIds: ["sensor.room"], start: "2026-07-17T10:00:00Z" }), /api\/history\/period\/.*minimal_response.*filter_entity_id=sensor.room/);
  assert.match(homeAssistantSourceRequest("https://ha.example", { resource: "logbook", entityId: "light.room", start: "2026-07-17T10:00:00Z" }), /api\/logbook\/.*entity=light.room/);
  assert.match(homeAssistantSourceRequest("https://ha.example", { resource: "calendar_events", calendarId: "calendar.family", start: "a", end: "b" }), /api\/calendars\/calendar.family\?start=a&end=b/);
  assert.equal(homeAssistantSourceRequest("https://ha.example", { resource: "camera", entityId: "camera.door" }), "https://ha.example/api/camera_proxy/camera.door");
});

test("OAuth-Refresh und Antwortgrößenlimit sind fest definiert", async () => {
  const form = oauthRefreshForm("refresh-secret", "https://studio.example");
  assert.equal(form.get("grant_type"), "refresh_token");
  assert.equal(form.get("refresh_token"), "refresh-secret");
  assert.equal(form.get("client_id"), "https://studio.example");
  await assert.rejects(limitedResponse(new Response(new Uint8Array(1024 * 1024 + 1))), /1 MB/);
});

test("DNS-Auflösungswechsel werden erkannt", () => {
  assert.equal(dnsAnswersChanged(new Set(["203.0.113.1"]), new Set(["203.0.113.1"])), false);
  assert.equal(dnsAnswersChanged(new Set(["203.0.113.1"]), new Set(["203.0.113.2"])), true);
});
