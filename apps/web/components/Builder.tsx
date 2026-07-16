"use client";

import { useEffect, useMemo, useState } from "react";
import { addDefaultWeatherWidgets, blankDashboard, createWidget, formatValue, type DashboardDocument, type DataSource, type Widget, type WidgetType, valueAtPath, weatherTemplate } from "../lib/dashboard";
import { decryptDocument, encryptDocument, type EncryptedEnvelope } from "../lib/crypto";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type Notice = { kind: "ok" | "error"; text: string } | null;

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return <>{now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</>;
}

function PreviewWidget({ widget, data }: { widget: Widget; data: Record<string, unknown> }) {
  let content: React.ReactNode = widget.staticValue ?? widget.title;
  if (widget.type === "clock") content = <Clock />;
  if (widget.type === "image") content = widget.imageUrl ? <img src={widget.imageUrl} alt={widget.title} /> : "Bild-URL fehlt";
  if (widget.type === "value" || widget.type === "weather") content = formatValue(valueAtPath(data[widget.dataSourceId ?? ""], widget.jsonPath), widget.format, widget.suffix);
  return (
    <article className={`preview-widget animation-${widget.animation ?? "none"}`} style={{ gridColumn: `${widget.x + 1} / span ${widget.width}`, gridRow: `${widget.y + 1} / span ${widget.height}`, background: widget.style.background, color: widget.style.foreground, textAlign: widget.style.align }}>
      <small>{widget.title}</small>
      <div className="widget-value">{widget.type === "weather" && <span className="weather-icon">☀</span>}{content}</div>
    </article>
  );
}

export default function Builder() {
  const [document, setDocument] = useState<DashboardDocument>(() => blankDashboard());
  const [selectedId, setSelectedId] = useState(document.widgets[0]?.id ?? "");
  const [tab, setTab] = useState<"widgets" | "data" | "settings">("widgets");
  const [passphrase, setPassphrase] = useState("");
  const [dashboardId, setDashboardId] = useState("");
  const [editToken, setEditToken] = useState("");
  const [displayUrl, setDisplayUrl] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({});
  const [customTemplates, setCustomTemplates] = useState<{ name: string; document: DashboardDocument }[]>([]);
  const selected = document.widgets.find((item) => item.id === selectedId);

  useEffect(() => {
    const saved = localStorage.getItem("display-project");
    if (!saved) return;
    try {
      const project = JSON.parse(saved) as { dashboardId: string; editToken: string; displayUrl: string };
      setDashboardId(project.dashboardId); setEditToken(project.editToken); setDisplayUrl(project.displayUrl);
    } catch { localStorage.removeItem("display-project"); }
    try { setCustomTemplates(JSON.parse(localStorage.getItem("display-templates") ?? "[]")); } catch { localStorage.removeItem("display-templates"); }
  }, []);

  const patchDocument = (patch: Partial<DashboardDocument>) => setDocument((current) => ({ ...current, ...patch }));
  const patchWidget = (patch: Partial<Widget>) => setDocument((current) => ({ ...current, widgets: current.widgets.map((item) => item.id === selectedId ? { ...item, ...patch } : item) }));
  const patchStyle = (patch: Partial<Widget["style"]>) => selected && patchWidget({ style: { ...selected.style, ...patch } });
  const patchSource = (id: string, patch: Partial<DataSource>) => setDocument((current) => ({ ...current, dataSources: current.dataSources.map((source) => source.id === id ? { ...source, ...patch } : source) }));

  const save = async (publish: boolean) => {
    setNotice(null); setBusy(true);
    try {
      const envelope = await encryptDocument(document, passphrase);
      let id = dashboardId; let token = editToken; let url = displayUrl;
      if (!id) {
        const response = await fetch(`${API}/api/dashboards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ envelope }) });
        if (!response.ok) throw new Error((await response.json()).error ?? "Dashboard konnte nicht erstellt werden");
        const result = await response.json() as { id: string; editToken: string; displayUrl: string };
        id = result.id; token = result.editToken; url = result.displayUrl;
        setDashboardId(id); setEditToken(token); setDisplayUrl(url);
        localStorage.setItem("display-project", JSON.stringify({ dashboardId: id, editToken: token, displayUrl: url }));
      } else {
        const response = await fetch(`${API}/api/dashboards/${id}/draft`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Edit-Token": token }, body: JSON.stringify({ envelope }) });
        if (!response.ok) throw new Error((await response.json()).error ?? "Entwurf konnte nicht gespeichert werden");
      }
      if (publish) {
        const response = await fetch(`${API}/api/dashboards/${id}/publish`, { method: "POST", headers: { "X-Edit-Token": token } });
        if (!response.ok) throw new Error((await response.json()).error ?? "Veröffentlichung fehlgeschlagen");
        const result = await response.json() as { version: number };
        setNotice({ kind: "ok", text: `Version ${result.version} ist live.` });
      } else setNotice({ kind: "ok", text: "Verschlüsselter Entwurf gespeichert." });
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unbekannter Fehler" }); }
    finally { setBusy(false); }
  };

  const loadDraft = async () => {
    setBusy(true); setNotice(null);
    try {
      if (!dashboardId || !editToken || !passphrase) throw new Error("Projekt, Bearbeitungsschlüssel oder PIN fehlt.");
      const response = await fetch(`${API}/api/dashboards/${dashboardId}/draft`, { headers: { "X-Edit-Token": editToken } });
      if (!response.ok) throw new Error((await response.json()).error ?? "Entwurf konnte nicht geladen werden");
      const result = await response.json() as { envelope: EncryptedEnvelope };
      const loaded = await decryptDocument<DashboardDocument>(result.envelope, passphrase);
      setDocument(loaded); setSelectedId(loaded.widgets[0]?.id ?? ""); setNotice({ kind: "ok", text: "Entwurf entschlüsselt und geladen." });
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Entschlüsselung fehlgeschlagen" }); }
    finally { setBusy(false); }
  };

  const testSource = async (source: DataSource) => {
    try {
      const headers = { ...source.headers };
      if (source.auth.type === "bearer" && source.auth.value) headers.Authorization = `Bearer ${source.auth.value}`;
      if (source.auth.type === "apiKey" && source.auth.name && source.auth.value) headers[source.auth.name] = source.auth.value;
      if (source.auth.type === "basic") headers.Authorization = `Basic ${btoa(`${source.auth.username ?? ""}:${source.auth.password ?? ""}`)}`;
      const response = await fetch(source.url, { method: source.method, headers, body: source.method === "GET" ? undefined : source.body });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setPreviewData((current) => ({ ...current, [source.id]: response.headers.get("content-type")?.includes("json") ? undefined : null }));
      const json = await response.json(); setPreviewData((current) => ({ ...current, [source.id]: json })); setNotice({ kind: "ok", text: `${source.name}: Test erfolgreich.` });
    } catch (error) { setNotice({ kind: "error", text: `API-Test fehlgeschlagen: ${error instanceof Error ? error.message : error}` }); }
  };

  const templates = useMemo(() => [{ name: "Leer", create: blankDashboard }, { name: "Wetter", create: () => addDefaultWeatherWidgets(weatherTemplate()) }], []);

  return <main className="builder-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">d</span><div><strong>display</strong><small>Dashboard Studio</small></div></div>
      <input className="dashboard-name" value={document.name} onChange={(event) => patchDocument({ name: event.target.value })} aria-label="Dashboard-Name" />
      <div className="publish-controls">
        <input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="PIN/Passphrase (min. 8)" />
        <button className="button ghost" disabled={busy} onClick={() => save(false)}>Entwurf</button>
        <button className="button primary" disabled={busy} onClick={() => save(true)}>{busy ? "Bitte warten …" : "Veröffentlichen"}</button>
      </div>
    </header>

    <section className="workspace">
      <aside className="sidebar left-panel">
        <nav className="tabs">
          <button className={tab === "widgets" ? "active" : ""} onClick={() => setTab("widgets")}>Widgets</button>
          <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>Daten</button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Setup</button>
        </nav>
        {tab === "widgets" && <div className="panel-content">
          <p className="eyebrow">Bausteine</p><div className="widget-library">
            {(["text", "clock", "image", "value", "weather"] as WidgetType[]).map((type) => <button key={type} onClick={() => { const item = createWidget(type, document.widgets.length); patchDocument({ widgets: [...document.widgets, item] }); setSelectedId(item.id); }}><span>{type === "text" ? "Tt" : type === "clock" ? "◷" : type === "image" ? "▧" : type === "value" ? "#" : "☀"}</span>{({ text: "Text", clock: "Uhr", image: "Bild", value: "API-Wert", weather: "Wetter" } as const)[type]}</button>)}
          </div>
          <p className="eyebrow">Ebenen</p><div className="layers">{document.widgets.map((item) => <button className={item.id === selectedId ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)}><span>{item.title}</span><small>{item.width}×{item.height}</small></button>)}</div>
        </div>}
        {tab === "data" && <div className="panel-content">
          <button className="button wide" onClick={() => patchDocument({ dataSources: [...document.dataSources, { id: crypto.randomUUID(), name: "Neue API", method: "GET", url: "https://", headers: {}, auth: { type: "none" } }] })}>+ Datenquelle</button>
          {document.dataSources.map((source) => <div className="source-card" key={source.id}>
            <input value={source.name} onChange={(e) => patchSource(source.id, { name: e.target.value })} />
            <div className="inline"><select value={source.method} onChange={(e) => patchSource(source.id, { method: e.target.value as DataSource["method"] })}>{["GET","POST","PUT","PATCH","DELETE"].map((m) => <option key={m}>{m}</option>)}</select><input value={source.url} onChange={(e) => patchSource(source.id, { url: e.target.value })} /></div>
            <label>Header <textarea placeholder={'Accept: application/json\nX-Tenant: demo'} value={Object.entries(source.headers).map(([key,value]) => `${key}: ${value}`).join("\n")} onChange={(e) => patchSource(source.id, { headers: Object.fromEntries(e.target.value.split("\n").map((line) => { const split=line.indexOf(":"); return split > 0 ? [line.slice(0,split).trim(),line.slice(split+1).trim()] : ["",""]; }).filter(([key]) => key)) })} /></label>
            {source.method !== "GET" && <label>JSON-Body<textarea value={source.body ?? ""} onChange={(e) => patchSource(source.id, { body: e.target.value })} placeholder='{"key":"value"}' /></label>}
            <div className="inline"><select value={source.auth.type} onChange={(e) => patchSource(source.id, { auth: { type: e.target.value as DataSource["auth"]["type"] } })}><option value="none">Keine Auth</option><option value="apiKey">API-Key</option><option value="bearer">Bearer</option><option value="basic">Basic</option></select><input type="number" min="10" title="Intervall in Sekunden" placeholder="Intervall" value={source.refreshSeconds ?? ""} onChange={(e) => patchSource(source.id, { refreshSeconds: e.target.value ? Number(e.target.value) : undefined })} /></div>
            {source.auth.type === "apiKey" && <div className="inline"><input placeholder="Header-Name" value={source.auth.name ?? "X-API-Key"} onChange={(e) => patchSource(source.id, { auth: { ...source.auth, name: e.target.value } })} /><input type="password" placeholder="API-Key" value={source.auth.value ?? ""} onChange={(e) => patchSource(source.id, { auth: { ...source.auth, value: e.target.value } })} /></div>}
            {source.auth.type === "bearer" && <input type="password" placeholder="Bearer Token" value={source.auth.value ?? ""} onChange={(e) => patchSource(source.id, { auth: { ...source.auth, value: e.target.value } })} />}
            {source.auth.type === "basic" && <div className="inline"><input placeholder="Benutzername" value={source.auth.username ?? ""} onChange={(e) => patchSource(source.id, { auth: { ...source.auth, username: e.target.value } })} /><input type="password" placeholder="Passwort" value={source.auth.password ?? ""} onChange={(e) => patchSource(source.id, { auth: { ...source.auth, password: e.target.value } })} /></div>}
            <button className="text-button" onClick={() => testSource(source)}>Verbindung testen →</button>
          </div>)}
        </div>}
        {tab === "settings" && <div className="panel-content form-stack">
          <label>Konfigurationsprüfung (Sek.)<input type="number" min="10" value={document.settings.configPollSeconds} onChange={(e) => patchDocument({ settings: { ...document.settings, configPollSeconds: Number(e.target.value) } })} /></label>
          <label>Daten-Standard (Sek.)<input type="number" min="10" value={document.settings.dataPollSeconds} onChange={(e) => patchDocument({ settings: { ...document.settings, dataPollSeconds: Number(e.target.value) } })} /></label>
          <label>Hintergrund<input type="color" value={document.settings.background} onChange={(e) => patchDocument({ settings: { ...document.settings, background: e.target.value } })} /></label>
          <p className="eyebrow">Vorlagen</p>{templates.map((template) => <button className="template" key={template.name} onClick={() => { const next = template.create(); setDocument(next); setSelectedId(next.widgets[0]?.id ?? ""); }}>{template.name}</button>)}
          {customTemplates.map((template, index) => <button className="template" key={`${template.name}-${index}`} onClick={() => { const next = structuredClone(template.document); next.widgets.forEach((item) => { item.id=crypto.randomUUID(); }); next.dataSources.forEach((item) => { const old=item.id; item.id=crypto.randomUUID(); next.widgets.filter((widget) => widget.dataSourceId===old).forEach((widget) => { widget.dataSourceId=item.id; }); item.auth={type:"none"}; }); setDocument(next); setSelectedId(next.widgets[0]?.id ?? ""); }}>{template.name} · eigen</button>)}
          <button className="text-button" onClick={() => { const clean=structuredClone(document); clean.dataSources.forEach((source) => { source.auth={type:"none"}; }); const next=[...customTemplates,{name:document.name,document:clean}]; setCustomTemplates(next); localStorage.setItem("display-templates",JSON.stringify(next)); setNotice({kind:"ok",text:"Template ohne Zugangsdaten gespeichert."}); }}>Aktuelles Dashboard als Template speichern →</button>
          {dashboardId && <><p className="eyebrow">Projekt</p><code>{dashboardId}</code><button className="text-button" onClick={loadDraft}>Entwurf neu laden</button></>}
        </div>}
      </aside>

      <section className="canvas-area">
        <div className="canvas-toolbar"><span><i /> Live Preview</span><span>1920 × 1080 · Landscape</span></div>
        <div className="display-frame"><div className="display-grid" style={{ background: document.settings.background, color: document.settings.foreground, gridTemplateColumns: `repeat(${document.settings.columns}, 1fr)`, gridTemplateRows: `repeat(${document.settings.rows}, 1fr)` }}>{document.widgets.map((item) => <div key={item.id} className={item.id === selectedId ? "selected-outline" : ""} onClick={() => setSelectedId(item.id)}><PreviewWidget widget={item} data={previewData} /></div>)}</div></div>
        {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}
        {displayUrl && <div className="share-bar"><span>Client-URL</span><code>{displayUrl}</code><button onClick={() => navigator.clipboard.writeText(displayUrl)}>Kopieren</button></div>}
      </section>

      <aside className="sidebar inspector"><h2>Eigenschaften</h2>{selected ? <div className="panel-content form-stack">
        <label>Titel<input value={selected.title} onChange={(e) => patchWidget({ title: e.target.value })} /></label>
        {(selected.type === "text") && <label>Inhalt<textarea value={selected.staticValue ?? ""} onChange={(e) => patchWidget({ staticValue: e.target.value })} /></label>}
        {selected.type === "image" && <label>Bild-URL<input value={selected.imageUrl ?? ""} onChange={(e) => patchWidget({ imageUrl: e.target.value })} /></label>}
        {(selected.type === "value" || selected.type === "weather") && <><label>Datenquelle<select value={selected.dataSourceId ?? ""} onChange={(e) => patchWidget({ dataSourceId: e.target.value })}><option value="">Auswählen …</option>{document.dataSources.map((source) => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label><label>JSON-Pfad<input value={selected.jsonPath ?? ""} onChange={(e) => patchWidget({ jsonPath: e.target.value })} /></label><div className="inline"><label>Format<select value={selected.format ?? "text"} onChange={(e) => patchWidget({ format: e.target.value as Widget["format"] })}><option value="text">Text</option><option value="number">Zahl</option><option value="date">Datum</option><option value="temperature">Temperatur</option></select></label><label>Suffix<input value={selected.suffix ?? ""} onChange={(e) => patchWidget({ suffix: e.target.value })} /></label></div></>}
        <p className="eyebrow">Position & Größe</p><div className="quad">{(["x","y","width","height"] as const).map((key) => <label key={key}>{key}<input type="number" min={key === "width" || key === "height" ? 1 : 0} max={key === "x" || key === "width" ? 12 : 8} value={selected[key]} onChange={(e) => patchWidget({ [key]: Number(e.target.value) })} /></label>)}</div>
        <p className="eyebrow">Darstellung</p><div className="inline colors"><label>Fläche<input type="color" value={selected.style.background} onChange={(e) => patchStyle({ background: e.target.value })} /></label><label>Text<input type="color" value={selected.style.foreground} onChange={(e) => patchStyle({ foreground: e.target.value })} /></label></div>
        <label>Animation<select value={selected.animation} onChange={(e) => patchWidget({ animation: e.target.value as Widget["animation"] })}><option value="none">Keine</option><option value="pulse">Pulse</option><option value="float">Float</option><option value="glow">Glow</option></select></label>
        <label>Bei Fehler<select value={selected.errorBehavior} onChange={(e) => patchWidget({ errorBehavior: e.target.value as Widget["errorBehavior"] })}><option value="stale">Letzten Wert</option><option value="empty">Leer</option><option value="error">Fehler anzeigen</option></select></label>
        <button className="danger-button" onClick={() => { patchDocument({ widgets: document.widgets.filter((item) => item.id !== selected.id) }); setSelectedId(""); }}>Widget löschen</button>
      </div> : <p className="empty-state">Wähle ein Widget in der Vorschau aus.</p>}</aside>
    </section>
  </main>;
}
