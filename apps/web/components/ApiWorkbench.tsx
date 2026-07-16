"use client";

import { useMemo, useState } from "react";
import { parsedResponseBody, requestHeaders, type ApiDiagnostic } from "../lib/api-diagnostics";
import type { DataSource } from "../lib/dashboard";

type JsonLeaf = { path: string; value: unknown };
function jsonLeaves(value: unknown, path = "", result: JsonLeaf[] = []): JsonLeaf[] {
  if (value !== null && typeof value === "object") {
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value as Record<string, unknown>);
    if (!entries.length) result.push({ path, value });
    entries.forEach(([key, item]) => jsonLeaves(item, path ? `${path}.${key}` : key, result));
  } else result.push({ path, value });
  return result;
}

const secretHeader = (key: string) => /authorization|api[-_]?key|token|secret|cookie/i.test(key);
const redact = (headers: Record<string, string>, reveal: boolean) => Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, !reveal && secretHeader(key) ? "••••••••" : value]));
const pretty = (body: string, contentType = "") => {
  if (!body) return "(leer)";
  if (!contentType.includes("json")) return body;
  try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; }
};
const headerText = (headers: Record<string, string>) => Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join("\n") || "(keine)";

export default function ApiWorkbench({ sources, onAdd, onPatch, onRemove, onData, onMap, onClose }: {
  sources: DataSource[];
  onAdd: () => string;
  onPatch: (id: string, patch: Partial<DataSource>) => void;
  onRemove: (id: string) => void;
  onData: (id: string, data: unknown) => void;
  onMap: (source: DataSource, leaf: JsonLeaf, create?: boolean) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(sources[0]?.id ?? "");
  const [diagnostics, setDiagnostics] = useState<Record<string, ApiDiagnostic>>({});
  const [busyId, setBusyId] = useState("");
  const [revealSecrets, setRevealSecrets] = useState(false);
  const source = sources.find((item) => item.id === selectedId) ?? sources[0];
  const diagnostic = source ? diagnostics[source.id] : undefined;
  const json = diagnostic ? parsedResponseBody(diagnostic) : undefined;
  const leaves = useMemo(() => json === undefined ? [] : jsonLeaves(json).slice(0, 500), [json]);

  const test = async () => {
    if (!source) return;
    setBusyId(source.id);
    try {
      const response = await fetch("/api/data-source/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
      const result = await response.json() as { diagnostic?: ApiDiagnostic; error?: { code?: string; message?: string } };
      if (!response.ok || !result.diagnostic) throw new Error(`${result.error?.code ? `${result.error.code}: ` : ""}${result.error?.message ?? `HTTP ${response.status}`}`);
      setDiagnostics((current) => ({ ...current, [source.id]: result.diagnostic! }));
      const data = parsedResponseBody(result.diagnostic);
      if (data !== undefined) onData(source.id, data);
    } catch (error) {
      const now = new Date().toISOString();
      setDiagnostics((current) => ({ ...current, [source.id]: { ok: false, startedAt: now, durationMs: 0, request: { method: source.method, url: source.url, headers: requestHeaders(source), body: source.method === "GET" ? null : source.body ?? "" }, error: { code: "DIAGNOSTIC_ENDPOINT_ERROR", title: "Diagnose konnte nicht ausgeführt werden", detail: error instanceof Error ? error.message : String(error), hint: "Anmeldung und den lokalen Display-Server prüfen." } } }));
    } finally { setBusyId(""); }
  };

  return <section className="api-workbench">
    <header className="api-heading">
      <div><span className="eyebrow">API Studio</span><h1>Requests vollständig verstehen.</h1><p>Konfiguration, Netzwerkdiagnose, kompletter Request und komplette Response an einem Ort.</p></div>
      <div className="api-heading-actions"><button className="button ghost" onClick={onClose}>← Dashboard</button><button className="button primary" onClick={() => setSelectedId(onAdd())}>+ Datenquelle</button></div>
    </header>
    <div className="api-layout">
      <aside className="api-source-list">
        <div className="api-list-title"><strong>Datenquellen</strong><span>{sources.length}</span></div>
        {sources.map((item) => <button key={item.id} className={item.id === source?.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span><span><strong>{item.name}</strong><small>{item.url || "Keine URL"}</small></span>{diagnostics[item.id] && <i className={diagnostics[item.id].ok ? "ok" : "error"} />}</button>)}
        {!sources.length && <p className="empty-state">Noch keine Datenquelle. Lege eine API an, um den ersten Request zu testen.</p>}
      </aside>
      {source ? <main className="api-main">
        <section className="api-card api-config">
          <div className="api-card-title"><div><h2>Request konfigurieren</h2><p>Diese Werte werden beim Dashboard gespeichert.</p></div><button className="danger-link" onClick={() => onRemove(source.id)}>Entfernen</button></div>
          <div className="api-form-grid"><label>Name<input value={source.name} onChange={(event) => onPatch(source.id, { name: event.target.value })} /></label><label className="url-field">Endpoint<div className="request-line"><select value={source.method} onChange={(event) => onPatch(source.id, { method: event.target.value as DataSource["method"] })}>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method}>{method}</option>)}</select><input value={source.url} onChange={(event) => onPatch(source.id, { url: event.target.value })} /></div></label></div>
          <div className="api-form-grid"><label>Header<textarea spellCheck={false} placeholder={'Accept: application/json\nX-Tenant: demo'} value={Object.entries(source.headers).map(([key, value]) => `${key}: ${value}`).join("\n")} onChange={(event) => onPatch(source.id, { headers: Object.fromEntries(event.target.value.split("\n").map((line) => { const index = line.indexOf(":"); return index > 0 ? [line.slice(0, index).trim(), line.slice(index + 1).trim()] : ["", ""]; }).filter(([key]) => key)) })} /></label><label>JSON / Request-Body<textarea spellCheck={false} disabled={source.method === "GET"} value={source.body ?? ""} onChange={(event) => onPatch(source.id, { body: event.target.value })} placeholder={source.method === "GET" ? "GET sendet keinen Body" : '{"key":"value"}'} /></label></div>
          <div className="auth-row"><label>Authentifizierung<select value={source.auth.type} onChange={(event) => onPatch(source.id, { auth: { type: event.target.value as DataSource["auth"]["type"] } })}><option value="none">Keine</option><option value="apiKey">API-Key</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option></select></label>{source.auth.type === "apiKey" && <><label>Header-Name<input value={source.auth.name ?? "X-API-Key"} onChange={(event) => onPatch(source.id, { auth: { ...source.auth, name: event.target.value } })} /></label><label>API-Key<input type="password" value={source.auth.value ?? ""} onChange={(event) => onPatch(source.id, { auth: { ...source.auth, value: event.target.value } })} /></label></>}{source.auth.type === "bearer" && <label>Token<input type="password" value={source.auth.value ?? ""} onChange={(event) => onPatch(source.id, { auth: { ...source.auth, value: event.target.value } })} /></label>}{source.auth.type === "basic" && <><label>Benutzername<input value={source.auth.username ?? ""} onChange={(event) => onPatch(source.id, { auth: { ...source.auth, username: event.target.value } })} /></label><label>Passwort<input type="password" value={source.auth.password ?? ""} onChange={(event) => onPatch(source.id, { auth: { ...source.auth, password: event.target.value } })} /></label></>}<label>Intervall (Sek.)<input type="number" min="10" value={source.refreshSeconds ?? ""} onChange={(event) => onPatch(source.id, { refreshSeconds: event.target.value ? Number(event.target.value) : undefined })} /></label></div>
          <button className="button primary run-request" disabled={busyId === source.id || !source.url} onClick={test}>{busyId === source.id ? "Request läuft …" : `▶ ${source.method} Request ausführen`}</button>
        </section>
        {diagnostic ? <>
          <section className={`diagnostic-summary ${diagnostic.ok ? "success" : "failure"}`}><div className="diagnostic-icon">{diagnostic.ok ? "✓" : "!"}</div><div><span>{diagnostic.ok ? "Request erfolgreich" : diagnostic.error?.title ?? "Request fehlgeschlagen"}</span><strong>{diagnostic.response ? `${diagnostic.response.status} ${diagnostic.response.statusText}` : diagnostic.error?.code}</strong><p>{diagnostic.error?.detail ?? "Die API hat eine erfolgreiche Antwort geliefert."}</p>{diagnostic.error?.hint && <em>Hinweis: {diagnostic.error.hint}</em>}</div><dl><div><dt>Dauer</dt><dd>{diagnostic.durationMs} ms</dd></div><div><dt>Zeitpunkt</dt><dd>{new Date(diagnostic.startedAt).toLocaleTimeString("de-DE")}</dd></div><div><dt>Größe</dt><dd>{diagnostic.response ? `${diagnostic.response.sizeBytes.toLocaleString("de-DE")} B` : "—"}</dd></div></dl></section>
          <section className="exchange-grid">
            <article className="api-card exchange"><div className="api-card-title"><div><h2>Vollständiger Request</h2><p>Vom Diagnose-Server tatsächlich gesendet</p></div><label className="secret-toggle"><input type="checkbox" checked={revealSecrets} onChange={(event) => setRevealSecrets(event.target.checked)} /> Secrets zeigen</label></div><div className="exchange-meta"><span className={`method method-${diagnostic.request.method.toLowerCase()}`}>{diagnostic.request.method}</span><code>{diagnostic.request.url}</code></div><h3>Header</h3><pre>{headerText(redact(diagnostic.request.headers, revealSecrets))}</pre><h3>Body</h3><pre>{pretty(diagnostic.request.body ?? "")}</pre></article>
            <article className="api-card exchange"><div className="api-card-title"><div><h2>Vollständige Response</h2><p>{diagnostic.response?.redirected ? `Redirect-Ziel: ${diagnostic.response.url}` : "Ungekürzte Antwort bis 1 MB"}</p></div>{diagnostic.response && <span className={`status-chip ${diagnostic.ok ? "ok" : "error"}`}>{diagnostic.response.status}</span>}</div>{diagnostic.response ? <><div className="exchange-meta"><code>{diagnostic.response.contentType || "Content-Type unbekannt"}</code></div><h3>Header</h3><pre>{headerText(diagnostic.response.headers)}</pre><h3>Body {diagnostic.response.bodyTruncated && <small>bei 1 MB gekürzt</small>}</h3><pre>{pretty(diagnostic.response.body, diagnostic.response.contentType)}</pre></> : <p className="empty-state">Keine HTTP-Response empfangen. Der Fehler trat vor der Antwort auf.</p>}</article>
          </section>
          <section className="api-card codex-card"><div className="api-card-title"><div><h2>Codex-Kontext</h2><p>Fertiger technischer Kontext zum Kopieren – Secrets bleiben maskiert.</p></div><button className="button ghost" onClick={() => navigator.clipboard.writeText(`Analysiere diesen API-Request und erkläre Ursache und Fix.\n\n${JSON.stringify({ ...diagnostic, request: { ...diagnostic.request, headers: redact(diagnostic.request.headers, false) } }, null, 2)}`)}>Für Codex kopieren</button></div></section>
          {leaves.length > 0 && <section className="api-card fields-card"><div className="api-card-title"><div><h2>JSON-Felder zuordnen</h2><p>{leaves.length} Werte erkannt. Ein Feld dem ausgewählten Widget zuweisen oder ein neues Widget erstellen.</p></div></div><div className="field-table">{leaves.map((leaf) => <div key={leaf.path}><code>{leaf.path || "$"}</code><span>{typeof leaf.value === "string" ? leaf.value : JSON.stringify(leaf.value)}</span><button onClick={() => onMap(source, leaf)}>Zuweisen</button><button onClick={() => onMap(source, leaf, true)}>+ Widget</button></div>)}</div></section>}
        </> : <section className="api-empty"><span>↗</span><h2>Bereit für den ersten echten Request</h2><p>Führe den Test aus. Danach erscheinen hier Netzwerkdiagnose, Request, Response und alle JSON-Felder.</p></section>}
      </main> : <main className="api-empty"><span>+</span><h2>Neue Datenquelle anlegen</h2><p>APIs bekommen hier den Platz, den sie für eine saubere Diagnose brauchen.</p><button className="button primary" onClick={() => setSelectedId(onAdd())}>Datenquelle erstellen</button></main>}
    </div>
  </section>;
}
