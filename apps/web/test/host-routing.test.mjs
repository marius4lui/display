import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";

const port = 32187;
let server;
let database;
let upstream;
let pairingAttempt = null;
let upstreamRequest = null;
const validLookup = createHash("sha256").update("123456").digest("hex");

function request(path, host, method = "GET", body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        Host: host,
        ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
        ...extraHeaders,
      },
    }, (response) => {
      let content = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { content += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: content, headers: response.headers }));
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

before(async () => {
  database = http.createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url?.startsWith("/rest/v1/player_pairing_attempts")) {
      if (request.method === "GET") response.end(pairingAttempt ? JSON.stringify(pairingAttempt) : "[]");
      else if (request.method === "DELETE") { pairingAttempt = null; response.end("{}"); }
      else {
        let body = ""; for await (const chunk of request) body += chunk;
        pairingAttempt = JSON.parse(body);
        response.end("{}");
      }
      return;
    }
    if (request.url === "/rest/v1/rpc/consume_web_pairing_code" && request.method === "POST") {
      let body = ""; for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      response.end(input.lookup_hash === validLookup ? JSON.stringify([{ device_id: "10000000-0000-4000-8000-000000000001", display_id: "20000000-0000-4000-8000-000000000002" }]) : "[]");
      return;
    }
    if (request.url?.startsWith("/rest/v1/display_devices")) {
      response.end(request.method === "GET" ? JSON.stringify({
        id: "10000000-0000-4000-8000-000000000001",
        display_id: "20000000-0000-4000-8000-000000000002",
        name: "Test Browser",
        platform: "web",
      }) : "{}");
      return;
    }
    if (request.url === "/rest/v1/rpc/claim_player_action" && request.method === "POST") {
      response.end('"ok"');
      return;
    }
    if (request.url?.startsWith("/rest/v1/action_audit")) {
      response.end(request.method === "GET" ? "[]" : "{}");
      return;
    }
    if (request.url?.startsWith("/rest/v1/integrations")) {
      response.end(JSON.stringify({
        id: "40000000-0000-4000-8000-000000000004",
        owner_id: "30000000-0000-4000-8000-000000000003",
        provider: "n8n",
        base_url: "https://127.0.0.1",
        status: "active",
        credential_ciphertext: null,
        credential_iv: null,
        credential_auth_tag: null,
        metadata: {},
      }));
      return;
    }
    if (request.url?.startsWith("/rest/v1/displays")) {
      response.end(JSON.stringify({
        id: "20000000-0000-4000-8000-000000000002",
        owner_id: "30000000-0000-4000-8000-000000000003",
        public_id: "testdisplay",
        active_version: 1,
      }));
      return;
    }
    if (request.url?.startsWith("/rest/v1/display_versions")) {
      response.end(JSON.stringify({
        version: 1,
        published_at: "2026-07-17T12:00:00.000Z",
        document: {
          schemaVersion: 4,
          name: "Test",
          settings: { configPollSeconds: 30, dataPollSeconds: 60, columns: 12, rows: 8, background: "#000", foreground: "#fff" },
          dataSources: [{
            id: "home-assistant",
            name: "Home Assistant",
            method: "GET",
            url: "http://127.0.0.1:32189/api/state",
            headers: { "X-Proxy-Test": "server-side" },
            auth: { type: "bearer", value: "super-secret-token" },
            refreshSeconds: 30,
          }],
          actions: [{
            id: "published-action",
            name: "Production Webhook",
            integrationId: "40000000-0000-4000-8000-000000000004",
            provider: "n8n",
            operation: "n8n_webhook",
            target: { webhookPath: "/webhook/live", method: "POST" },
            confirmation: true,
            cooldownMs: 2000,
            timeoutMs: 20000,
          }],
          pages: [{ id: "page", name: "Seite 1", widgets: [] }],
          pageNavigation: { visible: false, x: 4, y: 7, width: 4, height: 1, style: { background: "#111", foreground: "#fff", accent: "#70f", align: "center" } },
        },
      }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ message: "mock route missing" }));
  });
  await new Promise((resolve) => database.listen(32188, "127.0.0.1", resolve));
  upstream = http.createServer((request, response) => {
    upstreamRequest = { method: request.method, authorization: request.headers.authorization, marker: request.headers["x-proxy-test"] };
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ state: "42", attributes: { unit_of_measurement: "°C" } }));
  });
  await new Promise((resolve) => upstream.listen(32189, "127.0.0.1", resolve));
  server = spawn(process.execPath, ["../../node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PUBLIC_APP_URL: `http://studio.localhost:${port}`,
      PUBLIC_DISPLAY_URL: `http://display.localhost:${port}`,
      ANDROID_APK_URL: "https://downloads.example.com/display.apk",
      SUPABASE_URL: "http://127.0.0.1:32188",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Next.js startete nicht:\n${output}`)), 30_000);
    const consume = (chunk) => {
      output += chunk.toString();
      if (output.includes("Ready")) { clearTimeout(timeout); resolve(); }
    };
    server.stdout.on("data", consume);
    server.stderr.on("data", consume);
    server.on("exit", (code) => { clearTimeout(timeout); reject(new Error(`Next.js wurde vorzeitig mit ${code} beendet:\n${output}`)); });
  });
});

after(() => {
  server?.kill("SIGTERM");
  database?.close();
  upstream?.close();
});

test("Display-Host liefert nur den Player", async () => {
  const player = await request("/", `display.localhost:${port}`);
  assert.equal(player.status, 200);
  assert.match(player.body, /Web Player/);
  const download = await request("/download/android", `display.localhost:${port}`);
  assert.equal(download.status, 307);
  assert.equal(download.headers.location, "https://downloads.example.com/display.apk");

  const studioApi = await request("/api/auth/session", `display.localhost:${port}`);
  assert.equal(studioApi.status, 404);
});

test("Studio-Host liefert keine Player-Oberfläche oder Player-API", async () => {
  const player = await request("/player", `studio.localhost:${port}`);
  assert.equal(player.status, 404);

  const playerApi = await request("/api/player/config", `studio.localhost:${port}`);
  assert.equal(playerApi.status, 404);
});

test("Pairing validiert den Code vor einem Datenbankzugriff", async () => {
  const response = await request("/api/player/pair", `display.localhost:${port}`, "POST", JSON.stringify({ code: "12" }));
  assert.equal(response.status, 400);
  assert.match(response.body, /sechsstelligen Code/);
  assert.equal(response.headers["set-cookie"], undefined);
});

test("Erfolgreiches Pairing setzt nur das hostgebundene HttpOnly-Token", async () => {
  const response = await request("/api/player/pair", `display.localhost:${port}`, "POST", JSON.stringify({ code: "123456" }));
  assert.equal(response.status, 201);
  assert.match(response.body, /"paired":true/);
  const cookie = response.headers["set-cookie"]?.[0] ?? "";
  assert.match(cookie, /^__Host-display-player=[A-Za-z0-9_-]+;/);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//i);
  assert.doesNotMatch(cookie, /Domain=/i);
  assert.doesNotMatch(response.body, /token/i);

  const cookieHeader = cookie.split(";", 1)[0];
  const config = await request("/api/player/config", `display.localhost:${port}`, "GET", undefined, { Cookie: cookieHeader });
  assert.equal(config.status, 200);
  assert.match(config.body, /"version":1/);
  assert.doesNotMatch(config.body, /127\.0\.0\.1:32189|super-secret-token|server-side/);
  assert.doesNotMatch(config.body, /webhook\/live|integrationId|n8n_webhook/);
  assert.ok(config.headers.etag);
  assert.match(config.headers["cache-control"] ?? "", /private, no-store/);

  const unchanged = await request("/api/player/config", `display.localhost:${port}`, "GET", undefined, { Cookie: cookieHeader, "If-None-Match": config.headers.etag });
  assert.equal(unchanged.status, 304);

  const data = await request("/api/player/data/home-assistant", `display.localhost:${port}`, "POST", undefined, { Cookie: cookieHeader });
  assert.equal(data.status, 200);
  assert.match(data.body, /"state":"42"/);
  assert.deepEqual(upstreamRequest, { method: "GET", authorization: "Bearer super-secret-token", marker: "server-side" });

  const outdated = await request("/api/player/data/home-assistant", `display.localhost:${port}`, "POST", undefined, { Cookie: cookieHeader, "X-Player-Config-Version": "999" });
  assert.equal(outdated.status, 409);
  assert.match(outdated.body, /CONFIG_CHANGED/);

  const unknownSource = await request("/api/player/data/not-published", `display.localhost:${port}`, "POST", undefined, { Cookie: cookieHeader });
  assert.equal(unknownSource.status, 404);

  const unknownAction = await request("/api/player/actions/not-published", `display.localhost:${port}`, "POST", undefined, { Cookie: cookieHeader, "X-Player-Config-Version": "1", "Idempotency-Key": "unknown-action" });
  assert.equal(unknownAction.status, 404);

  const blockedAction = await request("/api/player/actions/published-action", `display.localhost:${port}`, "POST", undefined, { Cookie: cookieHeader, "X-Player-Config-Version": "1", "Idempotency-Key": "action-attempt-1" });
  assert.equal(blockedAction.status, 502);
  assert.match(blockedAction.body, /"status":"failed"/);

  const heartbeat = await request("/api/player/heartbeat", `display.localhost:${port}`, "POST", JSON.stringify({ appVersion: "web-test", dashboardVersion: 1 }), { Cookie: cookieHeader });
  assert.equal(heartbeat.status, 204);

  const disconnected = await request("/api/player/disconnect", `display.localhost:${port}`, "POST", undefined, { Cookie: cookieHeader });
  assert.equal(disconnected.status, 204);
  assert.match(disconnected.headers["set-cookie"]?.[0] ?? "", /Max-Age=0/);
});

test("Fehlversuche werden persistent begrenzt", async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request("/api/player/pair", `display.localhost:${port}`, "POST", JSON.stringify({ code: "654321" }));
    assert.equal(response.status, 401);
    assert.match(response.body, /ungültig, abgelaufen oder wurde bereits verwendet/);
  }
  const blocked = await request("/api/player/pair", `display.localhost:${port}`, "POST", JSON.stringify({ code: "654321" }));
  assert.equal(blocked.status, 429);
  assert.match(blocked.body, /Zu viele Versuche/);
});
