"use client";

import { useEffect, useMemo, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { addDefaultWeatherWidgets, blankDashboard, createWidget, formatValue, type DashboardDocument, type DataSource, type Widget, type WidgetType, valueAtPath, weatherTemplate } from "../lib/dashboard";
import { decryptDocument, encryptDocument, type EncryptedEnvelope } from "../lib/crypto";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type Notice = { kind: "ok" | "error"; text: string } | null;

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return <>{now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</>;
}

type JsonLeaf = { path: string; value: unknown };
type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
type Placement = { x: number; y: number; width: number; height: number };
type DragPayload = Placement & ({ kind: "existing"; id: string } | { kind: "new"; widgetType: WidgetType });

function jsonLeaves(value: unknown, path = "", result: JsonLeaf[] = []): JsonLeaf[] {
  if (value !== null && typeof value === "object") {
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value as Record<string, unknown>);
    if (!entries.length) result.push({ path, value });
    entries.forEach(([key, item]) => jsonLeaves(item, path ? `${path}.${key}` : key, result));
  } else result.push({ path, value });
  return result;
}

function PreviewWidget({ widget, data, selected, onSelect, onDragStart, onDragEnd, onResizeStart }: { widget: Widget; data: Record<string, unknown>; selected: boolean; onSelect: () => void; onDragStart: (event: DragEvent<HTMLElement>) => void; onDragEnd: () => void; onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>, direction: ResizeDirection) => void }) {
  let content: React.ReactNode = widget.staticValue ?? widget.title;
  if (widget.type === "clock") content = <Clock />;
  if (widget.type === "image") content = widget.imageUrl ? <img src={widget.imageUrl} alt={widget.title} /> : "Bild-URL fehlt";
  if (widget.type === "value" || widget.type === "weather") content = formatValue(valueAtPath(data[widget.dataSourceId ?? ""], widget.jsonPath), widget.format, widget.suffix);
  return (
    <article draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onSelect} className={`preview-widget animation-${widget.animation ?? "none"}${selected ? " selected-outline" : ""}`} style={{ gridColumn: `${widget.x + 1} / span ${widget.width}`, gridRow: `${widget.y + 1} / span ${widget.height}`, background: widget.style.background, color: widget.style.foreground, textAlign: widget.style.align }}>
      <small>{widget.title}</small>
      <div className="widget-value">{widget.type === "weather" && <span className="weather-icon">☀</span>}{content}</div>
      {selected && (["n", "ne", "e", "se", "s", "sw", "w", "nw"] as ResizeDirection[]).map((direction) => <button draggable={false} aria-label={`Größe ${direction}`} className={`resize-handle resize-${direction}`} key={direction} onDragStart={(event) => event.preventDefault()} onPointerDown={(event) => onResizeStart(event, direction)} />)}
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
  const [dragging, setDragging] = useState(false);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

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
  const mapLeaf = (source: DataSource, leaf: JsonLeaf, create = false) => {
    if (create || !selected || (selected.type !== "value" && selected.type !== "weather")) {
      const item = createWidget("value", document.widgets.length);
      item.title = leaf.path.split(".").at(-1) || source.name;
      item.dataSourceId = source.id;
      item.jsonPath = leaf.path;
      patchDocument({ widgets: [...document.widgets, item] });
      setSelectedId(item.id);
    } else patchWidget({ dataSourceId: source.id, jsonPath: leaf.path });
    setNotice({ kind: "ok", text: `${leaf.path || "Antwort"} ist mit dem Widget verknüpft.` });
  };
  const dropOnCanvas = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const fallbackX = Math.floor((event.clientX - rect.left) / rect.width * document.settings.columns);
    const fallbackY = Math.floor((event.clientY - rect.top) / rect.height * document.settings.rows);
    const x = placement?.x ?? Math.max(0, Math.min(document.settings.columns - 1, fallbackX));
    const y = placement?.y ?? Math.max(0, Math.min(document.settings.rows - 1, fallbackY));
    const widgetId = event.dataTransfer.getData("application/x-display-widget");
    const widgetType = event.dataTransfer.getData("application/x-display-widget-type") as WidgetType;
    if (widgetId) {
      setDocument((current) => ({ ...current, widgets: current.widgets.map((item) => item.id === widgetId ? { ...item, x: Math.min(x, current.settings.columns - item.width), y: Math.min(y, current.settings.rows - item.height) } : item) }));
      setSelectedId(widgetId);
    } else if (widgetType) {
      const item = createWidget(widgetType, document.widgets.length);
      item.x = Math.min(x, document.settings.columns - item.width);
      item.y = Math.min(y, document.settings.rows - item.height);
      patchDocument({ widgets: [...document.widgets, item] });
      setSelectedId(item.id);
    }
    setDragging(false);
    setDragPayload(null);
    setPlacement(null);
  };
  const dragOverCanvas = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!dragPayload) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = Math.floor((event.clientX - rect.left) / rect.width * document.settings.columns);
    const rawY = Math.floor((event.clientY - rect.top) / rect.height * document.settings.rows);
    setPlacement({
      x: Math.max(0, Math.min(document.settings.columns - dragPayload.width, rawX)),
      y: Math.max(0, Math.min(document.settings.rows - dragPayload.height, rawY)),
      width: dragPayload.width,
      height: dragPayload.height,
    });
  };
  const finishDrag = () => {
    setDragging(false);
    setDragPayload(null);
    setPlacement(null);
  };
  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, widget: Widget, direction: ResizeDirection) => {
    event.preventDefault();
    event.stopPropagation();
    const grid = event.currentTarget.closest(".display-grid");
    if (!(grid instanceof HTMLElement)) return;
    const rect = grid.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY, widget: { ...widget } };
    const horizontal = direction.includes("e") || direction.includes("w");
    const vertical = direction.includes("n") || direction.includes("s");
    setDragging(true);
    const move = (pointer: PointerEvent) => {
      const dx = horizontal ? Math.round((pointer.clientX - origin.x) / (rect.width / document.settings.columns)) : 0;
      const dy = vertical ? Math.round((pointer.clientY - origin.y) / (rect.height / document.settings.rows)) : 0;
      const next = { x: origin.widget.x, y: origin.widget.y, width: origin.widget.width, height: origin.widget.height };
      if (direction.includes("e")) next.width = Math.max(1, Math.min(document.settings.columns - next.x, origin.widget.width + dx));
      if (direction.includes("s")) next.height = Math.max(1, Math.min(document.settings.rows - next.y, origin.widget.height + dy));
      if (direction.includes("w")) {
        next.x = Math.max(0, Math.min(origin.widget.x + origin.widget.width - 1, origin.widget.x + dx));
        next.width = origin.widget.width + origin.widget.x - next.x;
      }
      if (direction.includes("n")) {
        next.y = Math.max(0, Math.min(origin.widget.y + origin.widget.height - 1, origin.widget.y + dy));
        next.height = origin.widget.height + origin.widget.y - next.y;
      }
      setDocument((current) => ({ ...current, widgets: current.widgets.map((item) => item.id === widget.id ? { ...item, ...next } : item) }));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

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
            {(["text", "clock", "image", "value", "weather"] as WidgetType[]).map((type) => <button draggable onDragStart={(event) => { const size = { width: type === "text" ? 6 : 4, height: 2 }; event.dataTransfer.setData("application/x-display-widget-type", type); setDragPayload({ kind: "new", widgetType: type, x: 0, y: 0, ...size }); setDragging(true); }} onDragEnd={finishDrag} key={type} onClick={() => { const item = createWidget(type, document.widgets.length); patchDocument({ widgets: [...document.widgets, item] }); setSelectedId(item.id); }}><span>{type === "text" ? "Tt" : type === "clock" ? "◷" : type === "image" ? "▧" : type === "value" ? "#" : "☀"}</span>{({ text: "Text", clock: "Uhr", image: "Bild", value: "API-Wert", weather: "Wetter" } as const)[type]}</button>)}
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
            {Object.prototype.hasOwnProperty.call(previewData, source.id) && <div className="response-mapper">
              <div className="mapper-heading"><span>API-Antwort</span><small>Feld wählen und visuell zuordnen</small></div>
              {jsonLeaves(previewData[source.id]).slice(0, 150).map((leaf) => <div className="mapping-row" key={leaf.path}>
                <button title="Diesem ausgewählten Widget zuordnen" onClick={() => mapLeaf(source, leaf)}><code>{leaf.path || "$"}</code><span>{typeof leaf.value === "string" ? leaf.value : JSON.stringify(leaf.value)}</span></button>
                <button className="add-mapping" title="Neues API-Wert-Widget erstellen" onClick={() => mapLeaf(source, leaf, true)}>+</button>
              </div>)}
            </div>}
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
        <div className={`display-frame${dragging ? " is-dragging" : ""}`}><div className="display-grid" onDragOver={dragOverCanvas} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPlacement(null); }} onDrop={dropOnCanvas} style={{ background: document.settings.background, color: document.settings.foreground, gridTemplateColumns: `repeat(${document.settings.columns}, 1fr)`, gridTemplateRows: `repeat(${document.settings.rows}, 1fr)` }}>{document.widgets.map((item) => <PreviewWidget key={item.id} widget={item} data={previewData} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id)} onDragStart={(event) => { event.dataTransfer.setData("application/x-display-widget", item.id); event.dataTransfer.effectAllowed = "move"; setDragPayload({ kind: "existing", id: item.id, x: item.x, y: item.y, width: item.width, height: item.height }); setDragging(true); }} onDragEnd={finishDrag} onResizeStart={(event, direction) => startResize(event, item, direction)} />)}{placement && <div className="placement-preview" style={{ gridColumn: `${placement.x + 1} / span ${placement.width}`, gridRow: `${placement.y + 1} / span ${placement.height}` }}><span>{placement.width} × {placement.height}</span></div>}</div></div>
        {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}
        {displayUrl && <div className="share-bar"><span>Client-URL</span><code>{displayUrl}</code><button onClick={() => navigator.clipboard.writeText(displayUrl)}>Kopieren</button></div>}
      </section>

      <aside className="sidebar inspector"><h2>Eigenschaften</h2>{selected ? <div className="panel-content form-stack">
        <label>Titel<input value={selected.title} onChange={(e) => patchWidget({ title: e.target.value })} /></label>
        {(selected.type === "text") && <label>Inhalt<textarea value={selected.staticValue ?? ""} onChange={(e) => patchWidget({ staticValue: e.target.value })} /></label>}
        {selected.type === "image" && <label>Bild-URL<input value={selected.imageUrl ?? ""} onChange={(e) => patchWidget({ imageUrl: e.target.value })} /></label>}
        {(selected.type === "value" || selected.type === "weather") && <><label>Datenquelle<select value={selected.dataSourceId ?? ""} onChange={(e) => patchWidget({ dataSourceId: e.target.value })}><option value="">Auswählen …</option>{document.dataSources.map((source) => <option value={source.id} key={source.id}>{source.name}</option>)}</select></label><label>JSON-Pfad<input value={selected.jsonPath ?? ""} onChange={(e) => patchWidget({ jsonPath: e.target.value })} /></label><div className="inline"><label>Format<select value={selected.format ?? "text"} onChange={(e) => patchWidget({ format: e.target.value as Widget["format"] })}><option value="text">Text</option><option value="number">Zahl</option><option value="date">Datum</option><option value="temperature">Temperatur</option></select></label><label>Suffix<input value={selected.suffix ?? ""} onChange={(e) => patchWidget({ suffix: e.target.value })} /></label></div></>}
        <p className="canvas-hint">Im Canvas ziehen · An Kanten oder Ecken skalieren</p>
        <details className="pro-settings"><summary>Profi: Position & Größe</summary><div className="quad">{(["x","y","width","height"] as const).map((key) => <label key={key}>{key}<input type="number" min={key === "width" || key === "height" ? 1 : 0} max={key === "x" || key === "width" ? 12 : 8} value={selected[key]} onChange={(e) => patchWidget({ [key]: Number(e.target.value) })} /></label>)}</div></details>
        <p className="eyebrow">Darstellung</p><div className="inline colors"><label>Fläche<input type="color" value={selected.style.background} onChange={(e) => patchStyle({ background: e.target.value })} /></label><label>Text<input type="color" value={selected.style.foreground} onChange={(e) => patchStyle({ foreground: e.target.value })} /></label></div>
        <label>Animation<select value={selected.animation} onChange={(e) => patchWidget({ animation: e.target.value as Widget["animation"] })}><option value="none">Keine</option><option value="pulse">Pulse</option><option value="float">Float</option><option value="glow">Glow</option></select></label>
        <label>Bei Fehler<select value={selected.errorBehavior} onChange={(e) => patchWidget({ errorBehavior: e.target.value as Widget["errorBehavior"] })}><option value="stale">Letzten Wert</option><option value="empty">Leer</option><option value="error">Fehler anzeigen</option></select></label>
        <button className="danger-button" onClick={() => { patchDocument({ widgets: document.widgets.filter((item) => item.id !== selected.id) }); setSelectedId(""); }}>Widget löschen</button>
      </div> : <p className="empty-state">Wähle ein Widget in der Vorschau aus.</p>}</aside>
    </section>
  </main>;
}
