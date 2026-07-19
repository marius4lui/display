"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardAction, DashboardDocument, DataSource, HomeAssistantDataSource, ImmichDataSource, N8nDataSource } from "../lib/dashboard";
import { Icon } from "./studio/Icons";

type Integration = {
  id: string; provider: "n8n" | "home_assistant" | "immich"; name: string; base_url: string;
  status: "pending" | "active" | "error" | "disabled"; metadata?: Record<string, unknown>;
  last_test_status?: string; last_test_error?: string;
};
type Form = { provider: Integration["provider"]; name: string; baseUrl: string; token: string; apiKey: string; webhookAuth: "none"|"header"|"basic"|"jwt"; headerName: string; headerValue: string; username: string; password: string; jwt: string };
const emptyForm = (): Form => ({ provider: "home_assistant", name: "", baseUrl: "https://", token: "", apiKey: "", webhookAuth: "none", headerName: "X-Webhook-Secret", headerValue: "", username: "", password: "", jwt: "" });
const restFields = { method: "GET" as const, url: "", headers: {}, query: {}, variables: {}, auth: { type: "none" as const }, refreshSeconds: 60 };

export default function IntegrationStudio({ document, onDocument, onClose, onNotice }: {
  document: DashboardDocument; onDocument: (patch: Partial<DashboardDocument>) => void; onClose: () => void; onNotice: (text: string, ok?: boolean) => void;
}) {
  const [items, setItems] = useState<Integration[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<Form>(emptyForm);
  const [tab, setTab] = useState<"connection"|"actions"|"data">("connection");
  const [busy, setBusy] = useState("");
  const [discovery, setDiscovery] = useState<Record<string, unknown>>({});
  const [discoverySearch, setDiscoverySearch] = useState("");
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const actions = document.actions.filter((action) => !selected || action.integrationId === selected.id);
  const sources = document.dataSources.filter((source) => ((source.type === "home_assistant" || source.type === "n8n" || source.type === "immich") && (!selected || source.integrationId === selected.id)) || (source.type === "action_response" && actions.some((action) => action.id === source.actionId)));
  const load = async () => {
    const response = await fetch("/api/integrations"); if (!response.ok) return;
    const result = await response.json() as { integrations: Integration[] }; setItems(result.integrations);
    setSelectedId((current) => result.integrations.some((item) => item.id === current) ? current : result.integrations[0]?.id ?? "");
  };
  useEffect(() => { void load(); }, []);
  const workflows = useMemo(() => Array.isArray(discovery.workflows) ? discovery.workflows as Array<Record<string, unknown>> : [], [discovery.workflows]);
  const services = Array.isArray(discovery.services) ? discovery.services as Array<{ domain: string; services: Record<string, { name?: string; description?: string; fields?: Record<string, { name?: string; description?: string; required?: boolean; example?: unknown; selector?: Record<string, unknown> }> }> }> : [];
  const states = (Array.isArray(discovery.states) ? discovery.states as Array<{ entity_id: string; attributes?: { friendly_name?: string } }> : []).filter((item) => `${item.entity_id} ${item.attributes?.friendly_name ?? ""}`.toLowerCase().includes(discoverySearch.toLowerCase()));
  const calendars = Array.isArray(discovery.calendars) ? discovery.calendars as Array<{ entity_id: string; name?: string }> : [];
  const albums = (Array.isArray(discovery.albums) ? discovery.albums as Array<{ id: string; albumName: string; assetCount: number; albumThumbnailAssetId?: string | null; updatedAt?: string }> : []).filter((item) => `${item.albumName} ${item.assetCount}`.toLowerCase().includes(discoverySearch.toLowerCase()));

  async function create() {
    setBusy("create");
    const credentials = form.provider === "home_assistant" ? { accessToken: form.token } : form.provider === "immich" ? { apiKey: form.apiKey } : { apiKey: form.apiKey || undefined, webhookAuth: form.webhookAuth, headerName: form.headerName, headerValue: form.headerValue, username: form.username, password: form.password, jwt: form.jwt };
    const defaultName = form.provider === "n8n" ? "n8n" : form.provider === "immich" ? "Immich" : "Home Assistant";
    const response = await fetch("/api/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: form.provider, name: form.name || defaultName, baseUrl: form.baseUrl, credentials }) });
    const result = await response.json(); setBusy("");
    if (!response.ok) return onNotice(result.error?.message ?? "Integration konnte nicht angelegt werden");
    setForm(emptyForm()); await load(); setSelectedId(result.id); onNotice("Integration angelegt.", true);
  }
  async function test() {
    if (!selected) return; setBusy("test");
    const response = await fetch(`/api/integrations/${selected.id}/test`, { method: "POST" }); const result = await response.json(); setBusy("");
    onNotice(response.ok ? "Verbindung erfolgreich." : result.error?.message ?? "Verbindung fehlgeschlagen", response.ok); await load();
  }
  async function oauth() {
    if (!selected) return; const response = await fetch(`/api/integrations/${selected.id}/oauth`, { method: "POST" }); const result = await response.json();
    if (!response.ok) return onNotice(result.error?.message ?? "OAuth konnte nicht gestartet werden");
    location.assign(result.authorizationUrl);
  }
  async function discover(resource: string) {
    if (!selected) return; setBusy(resource);
    const response = await fetch(`/api/integrations/${selected.id}/discovery?resource=${encodeURIComponent(resource)}`); const result = await response.json(); setBusy("");
    if (!response.ok) return onNotice(result.error?.message ?? "Discovery fehlgeschlagen");
    setDiscovery((current) => ({ ...current, [resource]: result.data })); onNotice(`${resource} geladen.`, true);
  }
  function addAction() {
    if (!selected) return;
    const action: DashboardAction = selected.provider === "n8n" ? {
      id: crypto.randomUUID(), name: "n8n Workflow", integrationId: selected.id, provider: "n8n", operation: "n8n_webhook",
      target: { webhookPath: "/webhook/", method: "POST" }, payload: {}, confirmation: true, cooldownMs: 2000, timeoutMs: 20_000,
    } : {
      id: crypto.randomUUID(), name: "Home Assistant Action", integrationId: selected.id, provider: "home_assistant", operation: "home_assistant_service",
      target: { domain: "light", service: "turn_on", selection: {} }, payload: {}, confirmation: true, cooldownMs: 2000, timeoutMs: 20_000,
    };
    onDocument({ actions: [...document.actions, action] });
  }
  function patchAction(id: string, patch: Partial<DashboardAction>) { onDocument({ actions: document.actions.map((action) => action.id === id ? { ...action, ...patch } : action) }); }
  function toggleResponseSource(action: DashboardAction) {
    if (action.responseSourceId) {
      onDocument({ actions: document.actions.map((item) => item.id === action.id ? { ...item, responseSourceId: undefined } : item), dataSources: document.dataSources.filter((source) => source.id !== action.responseSourceId) });
      return;
    }
    const source: DataSource = { ...restFields, type: "action_response", id: crypto.randomUUID(), name: `${action.name} Antwort`, actionId: action.id };
    onDocument({ actions: document.actions.map((item) => item.id === action.id ? { ...item, responseSourceId: source.id } : item), dataSources: [...document.dataSources, source] });
  }
  async function testAction(action: DashboardAction) {
    if (!confirm(`Aktion „${action.name}“ jetzt wirklich ausführen?`)) return;
    setBusy(action.id); const response = await fetch(`/api/integrations/${action.integrationId}/action-test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const result = await response.json(); setBusy("");
    onNotice(response.ok ? "Aktion erfolgreich ausgeführt." : result.error?.message ?? "Aktion fehlgeschlagen", response.ok);
  }
  function addHaSource(entityId: string, resource: HomeAssistantDataSource["resource"] = "states") {
    if (!selected) return;
    const source: HomeAssistantDataSource = { ...restFields, type: "home_assistant", id: crypto.randomUUID(), name: `${states.find((item) => item.entity_id === entityId)?.attributes?.friendly_name ?? entityId} · ${resource}`, integrationId: selected.id, resource, entityIds: [entityId], entityId, start: new Date(Date.now()-3600000).toISOString(), end: new Date(Date.now()+86400000).toISOString() };
    onDocument({ dataSources: [...document.dataSources, source] });
  }
  function addCalendar(calendarId: string, events: boolean) {
    if (!selected) return;
    const source: HomeAssistantDataSource = { ...restFields, type: "home_assistant", id: crypto.randomUUID(), name: calendars.find((item) => item.entity_id === calendarId)?.name ?? calendarId, integrationId: selected.id, resource: events ? "calendar_events" : "calendars", calendarId, start: new Date().toISOString(), end: new Date(Date.now()+86400000).toISOString() };
    onDocument({ dataSources: [...document.dataSources, source] });
  }
  function addN8nSource(workflowId: string) {
    if (!selected) return;
    const source: N8nDataSource = { ...restFields, type: "n8n", id: crypto.randomUUID(), name: "Letzte n8n-Ausführung", integrationId: selected.id, resource: "workflow_status", workflowId };
    onDocument({ dataSources: [...document.dataSources, source] });
  }
  function addImmichSource(album: { id: string; albumName: string }) {
    if (!selected) return;
    const source: ImmichDataSource = { ...restFields, type: "immich", id: crypto.randomUUID(), name: album.albumName, integrationId: selected.id, resource: "album", albumId: album.id, maxAssets: 500, refreshSeconds: 300 };
    onDocument({ dataSources: [...document.dataSources, source] });
    onNotice(`Album „${album.albumName}“ als Datenquelle hinzugefügt.`, true);
  }

  return <section className="integration-studio">
    <aside className="integration-sidebar">
      <header><div><small>Workspace</small><h2>Integrationen</h2></div></header>
      <div className="integration-list">{items.map((item) => <button className={item.id === selected?.id ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)}><strong>{item.name}</strong><small>{item.provider === "n8n" ? "n8n" : item.provider === "immich" ? "Immich" : "Home Assistant"} · {item.status}</small></button>)}{!items.length && <p>Noch keine Integration.</p>}</div>
      <footer><button className="secondary-button full" onClick={onClose}>Zurück zum Dashboard</button></footer>
    </aside>
    <main className="integration-workspace">
      <header><div><h1>{selected?.name ?? "Neue Integration"}</h1><small>Credentials bleiben verschlüsselt auf dem Server.</small></div>{selected && <span className={`integration-status ${selected.status}`}>{selected.status}</span>}</header>
      <nav>{(["connection","actions","data"] as const).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item === "connection" ? "Verbindung" : item === "actions" ? "Actions" : "Datenquellen"}</button>)}</nav>
      <div className="integration-content">
        {tab === "connection" && <>
          <section className="integration-card"><h3>Neue Integration</h3><div className="control-pair"><label>Provider<select value={form.provider} onChange={(event) => setForm({ ...emptyForm(), provider: event.target.value as Form["provider"] })}><option value="home_assistant">Home Assistant</option><option value="n8n">n8n</option><option value="immich">Immich</option></select></label><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label></div><label>{form.provider === "immich" ? "Öffentliche Immich API-URL (endet meist auf /api)" : "Öffentliche HTTPS-Basis-URL"}<input placeholder={form.provider === "immich" ? "https://photos.example.com/api" : "https://…"} value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}/></label>
            {form.provider === "home_assistant" ? <label>Long-Lived Access Token (OAuth alternativ nach dem Anlegen)<input type="password" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })}/></label> : form.provider === "immich" ? <><label>Immich API-Key<input type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })}/></label><p className="section-note">Der Schlüssel benötigt album.read, asset.read und asset.view.</p></> : <><label>Optionaler API-Key für Discovery<input type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })}/></label><label>Webhook-Authentifizierung<select value={form.webhookAuth} onChange={(event) => setForm({ ...form, webhookAuth: event.target.value as Form["webhookAuth"] })}><option value="none">Keine</option><option value="header">Header</option><option value="basic">Basic</option><option value="jwt">JWT</option></select></label>{form.webhookAuth === "header" && <div className="control-pair"><label>Header<input value={form.headerName} onChange={(event) => setForm({ ...form, headerName: event.target.value })}/></label><label>Wert<input type="password" value={form.headerValue} onChange={(event) => setForm({ ...form, headerValue: event.target.value })}/></label></div>}{form.webhookAuth === "basic" && <div className="control-pair"><label>Benutzer<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })}/></label><label>Passwort<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}/></label></div>}{form.webhookAuth === "jwt" && <label>JWT<input type="password" value={form.jwt} onChange={(event) => setForm({ ...form, jwt: event.target.value })}/></label>}</>}
            <button className="primary-button" disabled={busy === "create"} onClick={() => void create()}>Integration anlegen</button></section>
          {selected && <section className="integration-card"><h3>{selected.name}</h3><p>{selected.base_url}</p>{selected.last_test_error && <p className="player-error">{selected.last_test_error}</p>}<div className="button-row"><button className="primary-button" disabled={busy === "test"} onClick={() => void test()}>Verbindung testen</button>{selected.provider === "home_assistant" && <button className="secondary-button" onClick={() => void oauth()}>Mit OAuth verbinden</button>}<button className="danger-outline" onClick={async () => { if (!confirm("Integration löschen?")) return; await fetch(`/api/integrations/${selected.id}`, { method: "DELETE" }); await load(); }}>Löschen</button></div>{selected.provider === "n8n" && <p className="section-note">Community-API-Keys können weitreichende Rechte besitzen. Enterprise: nur workflow:list/read und execution:list/read vergeben.</p>}</section>}
        </>}
        {tab === "actions" && <>{selected?.provider === "immich" ? <section className="integration-card"><h3>Keine Actions</h3><p>Immich wird hier ausschließlich lesend für Album-Widgets verwendet.</p></section> : selected ? <><div className="button-row"><button className="primary-button" onClick={addAction}>Action hinzufügen</button><button className="secondary-button" onClick={() => void discover(selected.provider === "n8n" ? "workflows" : "services")}>{selected.provider === "n8n" ? "Workflows" : "Services"} laden</button></div>{actions.map((action) => <ActionCard key={action.id} action={action} workflows={workflows} services={services} busy={busy === action.id} onPatch={(patch) => patchAction(action.id, patch)} onTest={() => void testAction(action)} onToggleResponse={() => toggleResponseSource(action)} onDelete={() => onDocument({ actions: document.actions.filter((item) => item.id !== action.id), dataSources: document.dataSources.filter((source) => source.type !== "action_response" || source.actionId !== action.id) })}/>)}</> : <p>Integration auswählen.</p>}</>}
        {tab === "data" && <>{selected?.provider === "home_assistant" && <><div className="button-row"><button className="secondary-button" onClick={() => void discover("states")}>Entitäten laden</button><button className="secondary-button" onClick={() => void discover("calendars")}>Kalender laden</button></div><label>Entitäten durchsuchen<input placeholder="Name oder entity_id" value={discoverySearch} onChange={(event) => setDiscoverySearch(event.target.value)}/></label><div className="discovery-list">{states.map((state) => <article key={state.entity_id}><strong>{state.attributes?.friendly_name ?? state.entity_id}</strong><small>{state.entity_id}</small><div className="button-row"><button onClick={() => addHaSource(state.entity_id, "states")}>Zustand</button><button onClick={() => addHaSource(state.entity_id, "history")}>Historie</button><button onClick={() => addHaSource(state.entity_id, "logbook")}>Logbuch</button>{state.entity_id.startsWith("camera.") && <button onClick={() => addHaSource(state.entity_id, "camera")}>Kamera</button>}</div></article>)}</div>{calendars.length > 0 && <div className="discovery-list">{calendars.map((calendar) => <article key={calendar.entity_id}><strong>{calendar.name ?? calendar.entity_id}</strong><small>{calendar.entity_id}</small><button onClick={() => addCalendar(calendar.entity_id, true)}>Einträge hinzufügen</button></article>)}</div>}</>}{selected?.provider === "n8n" && <><button className="secondary-button" onClick={() => void discover("workflows")}>Aktive Workflows laden</button><div className="discovery-list">{workflows.map((workflow) => <button key={String(workflow.id)} onClick={() => addN8nSource(String(workflow.id))}><strong>{String(workflow.name ?? workflow.id)}</strong><small>Letzten Execution-Status hinzufügen</small></button>)}</div></>}{selected?.provider === "immich" && <><div className="button-row"><button className="primary-button" disabled={busy === "albums"} onClick={() => void discover("albums")}>Alben laden</button></div>{Array.isArray(discovery.albums) && <><label>Alben durchsuchen<input placeholder="Albumname" value={discoverySearch} onChange={(event) => setDiscoverySearch(event.target.value)}/></label><div className="discovery-list">{albums.map((album) => <article key={album.id}><strong>{album.albumName}</strong><small>{album.assetCount} Elemente{album.updatedAt ? ` · ${new Date(album.updatedAt).toLocaleDateString("de-DE")}` : ""}</small><button onClick={() => addImmichSource(album)}>Als Datenquelle hinzufügen</button></article>)}</div>{albums.length === 0 && <p className="section-note">Keine passenden Alben gefunden.</p>}</>}</>}{sources.length > 0 && <section className="integration-card"><h3>Konfigurierte Quellen</h3>{sources.map((source) => <div className="configured-row" key={source.id}><span><strong>{source.name}</strong><small>{source.type}{source.type === "home_assistant" ? ` · ${source.resource}` : source.type === "immich" ? " · Album" : ""}</small></span><button className="danger-outline" onClick={() => onDocument({ dataSources: document.dataSources.filter((item) => item.id !== source.id) })}>Entfernen</button></div>)}</section>}</>}
      </div>
    </main>
  </section>;
}

function ActionCard({ action, workflows, services, busy, onPatch, onTest, onToggleResponse, onDelete }: { action: DashboardAction; workflows: Array<Record<string, unknown>>; services: Array<{ domain: string; services: Record<string, { name?: string; fields?: Record<string, { name?: string; description?: string; required?: boolean; example?: unknown; selector?: Record<string, unknown> }> }> }>; busy: boolean; onPatch: (patch: Partial<DashboardAction>) => void; onTest: () => void; onToggleResponse: () => void; onDelete: () => void }) {
  const [payload, setPayload] = useState(JSON.stringify(action.payload ?? {}, null, 2));
  const [serviceSearch, setServiceSearch] = useState("");
  const serviceOptions = services.flatMap((domain) => Object.entries(domain.services).map(([service, value]) => ({ value: `${domain.domain}.${service}`, label: value.name ?? `${domain.domain}.${service}` }))).filter((item) => `${item.value} ${item.label}`.toLowerCase().includes(serviceSearch.toLowerCase()));
  const serviceDefinition = services.find((item) => item.domain === action.target.domain)?.services[action.target.service ?? ""];
  return <section className="integration-card action-card"><label>Name<input value={action.name} onChange={(event) => onPatch({ name: event.target.value })}/></label>
    {action.provider === "n8n" ? <><label>Erkannter Production-Webhook<select value={`${action.target.method ?? "POST"} ${action.target.webhookPath ?? ""}`} onChange={(event) => { const [method, ...path] = event.target.value.split(" "); onPatch({ target: { ...action.target, method: method as "GET"|"POST"|"PUT"|"PATCH", webhookPath: path.join(" ") } }); }}><option value={`${action.target.method ?? "POST"} ${action.target.webhookPath ?? ""}`}>Manuell: {action.target.method} {action.target.webhookPath}</option>{workflows.flatMap((workflow) => (Array.isArray(workflow.webhooks) ? workflow.webhooks as Array<Record<string, unknown>> : []).map((webhook) => <option key={`${workflow.id}:${webhook.nodeId}`} value={`${webhook.method} ${webhook.path}`}>{String(workflow.name)} · {String(webhook.nodeName)} · {String(webhook.method)} {String(webhook.path)}</option>))}</select></label><div className="control-pair"><label>Production-Webhook<input value={action.target.webhookPath ?? ""} onChange={(event) => onPatch({ target: { ...action.target, webhookPath: event.target.value } })}/></label><label>Methode<select value={action.target.method ?? "POST"} onChange={(event) => onPatch({ target: { ...action.target, method: event.target.value as "GET"|"POST"|"PUT"|"PATCH" } })}>{["GET","POST","PUT","PATCH"].map((method) => <option key={method}>{method}</option>)}</select></label></div></> : <><label>Services durchsuchen<input placeholder="Domain oder Action" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)}/></label><label>Service/Action<select value={`${action.target.domain}.${action.target.service}`} onChange={(event) => { const [domain, service] = event.target.value.split("."); onPatch({ target: { ...action.target, domain, service } }); }}><option value={`${action.target.domain}.${action.target.service}`}>{action.target.domain}.{action.target.service}</option>{serviceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="control-pair"><label>Ziel-Entitäten<input placeholder="light.kueche, switch.pumpe" value={action.target.selection?.entityId?.join(",") ?? ""} onChange={(event) => onPatch({ target: { ...action.target, selection: { ...action.target.selection, entityId: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } } })}/></label><label>Geräte-IDs<input value={action.target.selection?.deviceId?.join(",") ?? ""} onChange={(event) => onPatch({ target: { ...action.target, selection: { ...action.target.selection, deviceId: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } } })}/></label></div><label>Bereichs-IDs<input value={action.target.selection?.areaId?.join(",") ?? ""} onChange={(event) => onPatch({ target: { ...action.target, selection: { ...action.target.selection, areaId: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } } })}/></label>{serviceDefinition?.fields && <div className="dynamic-service-fields"><h4>Service-Felder</h4>{Object.entries(serviceDefinition.fields).map(([field, definition]) => <label key={field}>{definition.name ?? field}{definition.required ? " *" : ""}<input value={String(action.payload?.[field] ?? "")} placeholder={definition.example === undefined ? definition.description : String(definition.example)} onChange={(event) => onPatch({ payload: { ...(action.payload ?? {}), [field]: event.target.value } })}/></label>)}</div>}</>}
    <label>Payload (JSON)<textarea value={payload} onChange={(event) => setPayload(event.target.value)} onBlur={() => { try { onPatch({ payload: JSON.parse(payload) }); } catch {} }}/></label>
    <div className="control-pair"><label>Cooldown (ms)<input type="number" min="0" value={action.cooldownMs ?? 2000} onChange={(event) => onPatch({ cooldownMs: Number(event.target.value) })}/></label><label>Timeout (ms)<input type="number" min="1000" max="20000" value={action.timeoutMs ?? 20000} onChange={(event) => onPatch({ timeoutMs: Number(event.target.value) })}/></label></div>
    <label className="switch-row"><span><strong>Bestätigung</strong><small>Vor Ausführung im Player nachfragen</small></span><input type="checkbox" checked={action.confirmation !== false} onChange={(event) => onPatch({ confirmation: event.target.checked })}/></label>
    {action.provider === "n8n" && <label className="switch-row"><span><strong>Textantwort als Erfolgsmeldung</strong><small>Die Webhook-Antwort wird gekürzt im Button angezeigt</small></span><input type="checkbox" checked={!!action.useResponseMessage} onChange={(event) => onPatch({ useResponseMessage: event.target.checked })}/></label>}
    <label className="switch-row"><span><strong>Antwort als Datenquelle</strong><small>Maximal 1 MB JSON/Text, erst nach einem Klick verfügbar</small></span><input type="checkbox" checked={!!action.responseSourceId} onChange={onToggleResponse}/></label>
    <div className="button-row"><button className="secondary-button" disabled={busy} onClick={onTest}>Aktion testen</button><button className="danger-outline" onClick={onDelete}>Entfernen</button></div>
  </section>;
}
