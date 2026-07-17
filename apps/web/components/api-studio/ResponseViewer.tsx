"use client";

import { useMemo, useState } from "react";
import type { ApiDiagnostic } from "../../lib/api-diagnostics";
import { parsedResponseBody } from "../../lib/api-diagnostics";
import type { DataSource } from "../../lib/dashboard";
import { Icon } from "../studio/Icons";

type JsonLeaf = { path: string; value: unknown };
type ResponseTab = "body" | "fields" | "headers" | "request" | "diagnostics";

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
const pretty = (body: string, contentType = "") => { if (!body) return "(leer)"; if (!contentType.includes("json")) return body; try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; } };
const headerText = (headers: Record<string, string>) => Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join("\n") || "(keine)";

export function ResponseViewer({ source, diagnostic, onMap }: { source: DataSource; diagnostic?: ApiDiagnostic; onMap: (source: DataSource, leaf: JsonLeaf, create?: boolean) => void }) {
  const [tab, setTab] = useState<ResponseTab>("body");
  const [search, setSearch] = useState("");
  const [reveal, setReveal] = useState(false);
  const json = diagnostic ? parsedResponseBody(diagnostic) : undefined;
  const leaves = useMemo(() => json === undefined ? [] : jsonLeaves(json).filter((leaf) => !search || leaf.path.toLowerCase().includes(search.toLowerCase()) || String(leaf.value).toLowerCase().includes(search.toLowerCase())).slice(0, 500), [json, search]);
  if (!diagnostic) return <section className="response-workspace api-welcome"><div><span><Icon name="send"/></span><h2>Bereit zum Senden</h2><p>Die Response, erkannten JSON-Felder und technischen Details erscheinen hier nach dem ersten Request.</p><div className="welcome-shortcuts"><span>⌘ Enter</span> Request senden</div></div></section>;
  const copyContext = () => navigator.clipboard.writeText(`Analysiere diesen API-Request und erkläre Ursache und Fix.\n\n${JSON.stringify({ ...diagnostic, request: { ...diagnostic.request, headers: redact(diagnostic.request.headers, false) } }, null, 2)}`);
  return <section className="response-workspace">
    <header className="response-summary">
      <div className={`response-state ${diagnostic.ok ? "ok" : "error"}`}><i/>{diagnostic.response ? `${diagnostic.response.status} ${diagnostic.response.statusText}` : diagnostic.error?.code ?? "Fehler"}</div>
      <dl><div><dt>Dauer</dt><dd>{diagnostic.durationMs} ms</dd></div><div><dt>Größe</dt><dd>{diagnostic.response ? `${diagnostic.response.sizeBytes.toLocaleString("de-DE")} B` : "—"}</dd></div><div><dt>Zeit</dt><dd>{new Date(diagnostic.startedAt).toLocaleTimeString("de-DE")}</dd></div></dl>
      <button className="icon-button" title="Response Body kopieren" onClick={() => navigator.clipboard.writeText(diagnostic.response?.body ?? "")}><Icon name="copy"/></button>
    </header>
    <nav className="response-tabs">{([["body", "Body"], ["fields", `Fields${leaves.length ? ` ${leaves.length}` : ""}`], ["headers", "Headers"], ["request", "Request"], ["diagnostics", "Diagnostics"]] as const).map(([id, label]) => <button className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    <div className="response-content">
      {tab === "body" && (diagnostic.response ? <div className="code-view"><div><span>{diagnostic.response.contentType || "Content-Type unbekannt"}</span>{diagnostic.response.bodyTruncated && <em>bei 1 MB gekürzt</em>}</div><pre>{pretty(diagnostic.response.body, diagnostic.response.contentType)}</pre></div> : <div className="response-empty">Keine HTTP-Response empfangen. Der Fehler trat vor der Antwort auf.</div>)}
      {tab === "fields" && <div className="fields-view"><label className="search-box"><Icon name="search"/><input placeholder="Pfade und Werte durchsuchen" value={search} onChange={(event) => setSearch(event.target.value)}/></label>{leaves.length ? <div className="field-table">{leaves.map((leaf) => <div key={leaf.path}><code>{leaf.path || "$"}</code><span>{typeof leaf.value === "string" ? leaf.value : JSON.stringify(leaf.value)}</span><button onClick={() => onMap(source, leaf)}>Zuweisen</button><button onClick={() => onMap(source, leaf, true)}>+ Widget</button></div>)}</div> : <div className="response-empty">Keine JSON-Felder in dieser Response erkannt.</div>}</div>}
      {tab === "headers" && <div className="code-view"><div><span>Response Headers</span></div><pre>{diagnostic.response ? headerText(diagnostic.response.headers) : "(keine Response)"}</pre></div>}
      {tab === "request" && <div className="request-details"><header><span className={`method-badge method-${diagnostic.request.method.toLowerCase()}`}>{diagnostic.request.method}</span><code>{diagnostic.request.url}</code><label className="switch-compact"><input type="checkbox" checked={reveal} onChange={(event) => setReveal(event.target.checked)}/> Secrets zeigen</label></header><h3>Header</h3><pre>{headerText(redact(diagnostic.request.headers, reveal))}</pre><h3>Body</h3><pre>{pretty(diagnostic.request.body ?? "")}</pre></div>}
      {tab === "diagnostics" && <div className="diagnostics-view"><div className={`diagnostic-callout ${diagnostic.ok ? "ok" : "error"}`}><strong>{diagnostic.ok ? "Request erfolgreich" : diagnostic.error?.title ?? "Request fehlgeschlagen"}</strong><p>{diagnostic.error?.detail ?? "Die API hat eine erfolgreiche Antwort geliefert."}</p>{diagnostic.error?.hint && <em>{diagnostic.error.hint}</em>}</div><dl><div><dt>Tatsächliche URL</dt><dd><code>{diagnostic.request.url}</code></dd></div>{diagnostic.response && <><div><dt>Redirect</dt><dd>{diagnostic.response.redirected ? diagnostic.response.url : "Nein"}</dd></div><div><dt>Content-Type</dt><dd>{diagnostic.response.contentType || "Unbekannt"}</dd></div></>}</dl><button className="secondary-button" onClick={copyContext}><Icon name="copy"/> Codex-Kontext kopieren</button></div>}
    </div>
  </section>;
}
