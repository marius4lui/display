"use client";

import { useEffect, useState } from "react";
import { requestHeaders, type ApiDiagnostic } from "../lib/api-diagnostics";
import type { DataSource } from "../lib/dashboard";
import { KeyValueEditor } from "./api-studio/KeyValueEditor";
import { ResponseViewer } from "./api-studio/ResponseViewer";
import { SecretManager } from "./api-studio/SecretManager";
import { Icon } from "./studio/Icons";

type JsonLeaf = { path: string; value: unknown };
type RequestTab = "params" | "headers" | "auth" | "body" | "variables";
const methods: DataSource["method"][] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export default function ApiWorkbench({ sources, initialSourceId, onAdd, onPatch, onRemove, onData, onStatus, onMap, onClose }: {
  sources: DataSource[];
  initialSourceId?: string;
  onAdd: () => string;
  onPatch: (id: string, patch: Partial<DataSource>) => void;
  onRemove: (id: string) => void;
  onData: (id: string, data: unknown) => void;
  onStatus: (id: string, ok: boolean) => void;
  onMap: (source: DataSource, leaf: JsonLeaf, create?: boolean) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(initialSourceId || sources[0]?.id || "");
  const [requestTab, setRequestTab] = useState<RequestTab>("params");
  const [diagnostics, setDiagnostics] = useState<Record<string, ApiDiagnostic>>({});
  const [busyId, setBusyId] = useState("");
  const [secretsOpen, setSecretsOpen] = useState(false);
  const source = sources.find((item) => item.id === selectedId) ?? sources[0];
  const diagnostic = source ? diagnostics[source.id] : undefined;

  useEffect(() => { if (initialSourceId && sources.some((item) => item.id === initialSourceId)) setSelectedId(initialSourceId); }, [initialSourceId, sources]);

  const test = async () => {
    if (!source) return;
    setBusyId(source.id);
    try {
      const response = await fetch("/api/data-source/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
      const result = await response.json() as { diagnostic?: ApiDiagnostic; error?: { code?: string; message?: string } };
      if (!response.ok || !result.diagnostic) throw new Error(`${result.error?.code ? `${result.error.code}: ` : ""}${result.error?.message ?? `HTTP ${response.status}`}`);
      setDiagnostics((current) => ({ ...current, [source.id]: result.diagnostic! }));
      onStatus(source.id, result.diagnostic.ok);
      if (result.diagnostic.response?.contentType.includes("json")) {
        try { onData(source.id, JSON.parse(result.diagnostic.response.body)); } catch {}
      }
    } catch (error) {
      const now = new Date().toISOString();
      const failed: ApiDiagnostic = { ok: false, startedAt: now, durationMs: 0, request: { method: source.method, url: source.url, headers: requestHeaders(source), body: source.method === "GET" ? null : source.body ?? "" }, error: { code: "DIAGNOSTIC_ENDPOINT_ERROR", title: "Diagnose konnte nicht ausgeführt werden", detail: error instanceof Error ? error.message : String(error), hint: "Anmeldung und den lokalen Display-Server prüfen." } };
      setDiagnostics((current) => ({ ...current, [source.id]: failed }));
      onStatus(source.id, false);
    } finally { setBusyId(""); }
  };

  const insertSecret = (token: string) => {
    if (!source) return;
    if (requestTab === "body") onPatch(source.id, { body: `${source.body ?? ""}${source.body ? "\n" : ""}${token}` });
    else if (requestTab === "auth") onPatch(source.id, { auth: { ...source.auth, value: token } });
    else if (requestTab === "headers") {
      const key = source.headers.Authorization ? `X-Secret-${Object.keys(source.headers).length + 1}` : "Authorization";
      onPatch(source.id, { headers: { ...source.headers, [key]: token } });
    } else if (requestTab === "params") onPatch(source.id, { query: { ...source.query, secret: token } });
    else onPatch(source.id, { variables: { ...source.variables, SECRET: token } });
  };

  return <section className="api-studio">
    <aside className="api-sources">
      <header><div><small>Workspace</small><h2>API Studio</h2></div><button className="icon-button" title="Datenquelle hinzufügen" aria-label="Datenquelle hinzufügen" onClick={() => setSelectedId(onAdd())}><Icon name="plus"/></button></header>
      <div className="api-source-scroll">
        <div className="source-section-title"><span>Datenquellen</span><i>{sources.length}</i></div>
        {sources.map((item) => <button className={item.id === source?.id ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)}>
          <span className={`method-badge method-${item.method.toLowerCase()}`}>{item.method}</span>
          <span><strong>{item.name}</strong><small>{item.url || "Keine URL"}</small></span>
          {diagnostics[item.id] && <i className={diagnostics[item.id].ok ? "status-ok" : "status-error"}/>}
        </button>)}
        {sources.length === 0 && <div className="panel-empty"><Icon name="data"/><strong>Keine Datenquellen</strong><p>Erstelle einen Request, um eine API zu verbinden.</p></div>}
      </div>
      <footer><button className="secondary-button full" onClick={onClose}>Zurück zum Dashboard</button></footer>
    </aside>

    {source ? <main className="api-workspace">
      <header className="api-workspace-header">
        <div className="source-title"><input aria-label="Name der Datenquelle" value={source.name} onChange={(event) => onPatch(source.id, { name: event.target.value })}/><span>{diagnostic ? `Zuletzt getestet · ${new Date(diagnostic.startedAt).toLocaleTimeString("de-DE")}` : "Noch nicht getestet"}</span></div>
        <div><label className="interval-control">Intervall<input type="number" min="10" value={source.refreshSeconds ?? ""} onChange={(event) => onPatch(source.id, { refreshSeconds: event.target.value ? Number(event.target.value) : undefined })}/><span>s</span></label><button className="secondary-button" onClick={() => setSecretsOpen(true)}><Icon name="secrets"/> Secrets</button><button className="icon-button subtle-danger" aria-label="Datenquelle entfernen" title="Datenquelle entfernen" onClick={() => { if (confirm(`Datenquelle „${source.name}“ entfernen?`)) onRemove(source.id); }}><Icon name="trash"/></button></div>
      </header>
      <section className="request-builder">
        <div className="request-bar">
          <select className={`method-select method-${source.method.toLowerCase()}`} aria-label="HTTP-Methode" value={source.method} onChange={(event) => onPatch(source.id, { method: event.target.value as DataSource["method"] })}>{methods.map((method) => <option key={method}>{method}</option>)}</select>
          <input className="request-url" aria-label="Request URL" placeholder="https://api.example.com/data" value={source.url} onChange={(event) => onPatch(source.id, { url: event.target.value })} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void test(); }}/>
          <button className="primary-button send-button" disabled={busyId === source.id || !source.url} onClick={() => void test()}><Icon name="send"/>{busyId === source.id ? "Senden …" : "Senden"}</button>
        </div>
        <nav className="request-tabs">{([["params", "Params", Object.keys(source.query ?? {}).length], ["headers", "Headers", Object.keys(source.headers).length], ["auth", "Auth", source.auth.type === "none" ? 0 : 1], ["body", "Body", source.body ? 1 : 0], ["variables", "Variables", Object.keys(source.variables ?? {}).length]] as const).map(([id, label, count]) => <button className={requestTab === id ? "active" : ""} key={id} onClick={() => setRequestTab(id)}>{label}{count > 0 && <span>{count}</span>}</button>)}</nav>
        <div className="request-tab-content">
          {requestTab === "params" && <><div className="tab-intro"><div><h3>Query-Parameter</h3><p>Werden sicher an die Request-URL angehängt.</p></div></div><KeyValueEditor value={source.query ?? {}} keyPlaceholder="limit" valuePlaceholder="10" onChange={(query) => onPatch(source.id, { query })}/></>}
          {requestTab === "headers" && <><div className="tab-intro"><div><h3>Request Headers</h3><p>Secret-Referenzen bleiben serverseitig geschützt.</p></div><button className="text-action" onClick={() => setSecretsOpen(true)}><Icon name="secrets"/> Secret einfügen</button></div><KeyValueEditor value={source.headers} keyPlaceholder="Accept" valuePlaceholder="application/json" onChange={(headers) => onPatch(source.id, { headers })}/></>}
          {requestTab === "auth" && <AuthEditor source={source} onPatch={(auth) => onPatch(source.id, { auth })} onSecrets={() => setSecretsOpen(true)}/>}
          {requestTab === "body" && <><div className="tab-intro"><div><h3>Request Body</h3><p>{source.method === "GET" ? "GET Requests senden keinen Body." : "JSON, Text oder Variablen- und Secret-Referenzen."}</p></div><button className="text-action" onClick={() => setSecretsOpen(true)}><Icon name="secrets"/> Secret einfügen</button></div><textarea className="body-editor" spellCheck={false} disabled={source.method === "GET"} placeholder={source.method === "GET" ? "Für GET deaktiviert" : '{\n  \"key\": \"{{var.VALUE}}\"\n}'} value={source.body ?? ""} onChange={(event) => onPatch(source.id, { body: event.target.value })}/></>}
          {requestTab === "variables" && <><div className="tab-intro"><div><h3>Variablen</h3><p>Im Request als <code>{"{{var.NAME}}"}</code> verwenden.</p></div></div><KeyValueEditor value={source.variables ?? {}} keyPlaceholder="TENANT" valuePlaceholder="demo" onChange={(variables) => onPatch(source.id, { variables })}/></>}
        </div>
      </section>
      <ResponseViewer source={source} diagnostic={diagnostic} onMap={onMap}/>
    </main> : <main className="api-workspace-empty"><div><Icon name="data"/><h2>Ersten Request erstellen</h2><p>Lege eine Datenquelle an und teste sie direkt in der Workbench.</p><button className="primary-button" onClick={() => setSelectedId(onAdd())}><Icon name="plus"/> Datenquelle erstellen</button></div></main>}
    <SecretManager open={secretsOpen} onClose={() => setSecretsOpen(false)} onInsert={insertSecret}/>
  </section>;
}

function AuthEditor({ source, onPatch, onSecrets }: { source: DataSource; onPatch: (auth: DataSource["auth"]) => void; onSecrets: () => void }) {
  return <div className="auth-editor">
    <div className="tab-intro"><div><h3>Authentifizierung</h3><p>Zugangsdaten können direkt oder über den Secret Store referenziert werden.</p></div><button className="text-action" onClick={onSecrets}><Icon name="secrets"/> Secret verwenden</button></div>
    <span className="auth-types">{([["none", "Keine"], ["apiKey", "API Key"], ["bearer", "Bearer"], ["basic", "Basic"]] as const).map(([id, label]) => <button className={source.auth.type === id ? "active" : ""} key={id} onClick={() => onPatch({ type: id })}>{label}</button>)}</span>
    {source.auth.type === "none" && <div className="section-empty">Für diesen Request wird keine Authentifizierung gesendet.</div>}
    {source.auth.type === "apiKey" && <div className="control-pair"><label>Header-Name<input value={source.auth.name ?? "X-API-Key"} onChange={(event) => onPatch({ ...source.auth, name: event.target.value })}/></label><label>API Key<input type="password" value={source.auth.value ?? ""} onChange={(event) => onPatch({ ...source.auth, value: event.target.value })}/></label></div>}
    {source.auth.type === "bearer" && <label>Bearer Token<input type="password" value={source.auth.value ?? ""} onChange={(event) => onPatch({ ...source.auth, value: event.target.value })}/></label>}
    {source.auth.type === "basic" && <div className="control-pair"><label>Benutzername<input value={source.auth.username ?? ""} onChange={(event) => onPatch({ ...source.auth, username: event.target.value })}/></label><label>Passwort<input type="password" value={source.auth.password ?? ""} onChange={(event) => onPatch({ ...source.auth, password: event.target.value })}/></label></div>}
  </div>;
}
