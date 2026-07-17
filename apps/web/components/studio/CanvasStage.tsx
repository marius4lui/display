"use client";

import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { effectiveWidget, formatValue, valueAtPath, type DashboardDocument, type DashboardPage, type Widget } from "../../lib/dashboard";
import { Icon } from "./Icons";

export type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export type PreviewDevice = "display" | "desktop" | "tablet" | "mobile";
export type Placement = { x: number; y: number; width: number; height: number; valid?: boolean };
const devices: Record<PreviewDevice, { label: string; size: string; ratio: string }> = {
  display: { label: "Display", size: "1920 × 1080", ratio: "16 / 9" },
  desktop: { label: "Desktop", size: "1440 × 900", ratio: "16 / 10" },
  tablet: { label: "Tablet", size: "1024 × 768", ratio: "4 / 3" },
  mobile: { label: "Mobile", size: "390 × 844", ratio: "390 / 844" },
};

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return <>{now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</>;
}

function CanvasWidget({ widget, data, selected, interactive, onSelect, onDragStart, onDragEnd, onResizeStart }: {
  widget: Widget; data: Record<string, unknown>; selected: boolean; interactive: boolean;
  onSelect: () => void; onDragStart: (event: DragEvent<HTMLElement>) => void; onDragEnd: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>, direction: ResizeDirection) => void;
}) {
  const raw = valueAtPath(data[widget.dataSourceId ?? ""], widget.jsonPath);
  const effective = effectiveWidget(widget, raw);
  let content: React.ReactNode = effective.staticValue ?? effective.title;
  if (effective.type === "clock") content = <Clock/>;
  if (effective.type === "image") content = effective.imageUrl ? <img src={effective.imageUrl} alt={effective.title}/> : "Bild-URL fehlt";
  if (["value", "weather", "metric"].includes(effective.type)) content = formatValue(raw, effective.format, effective.suffix);
  if (effective.type === "status") { const state = effective.statusMap?.[String(raw)]; content = <span style={{ color: state?.color ?? effective.style.accent }}>{state?.icon ?? "●"} {state?.text ?? String(raw ?? "—")}</span>; }
  if (effective.type === "list") { const rows = Array.isArray(raw) ? raw.slice(0, effective.maxItems ?? 5) : []; content = <ul className="widget-list">{rows.map((row, index) => <li key={index}><strong>{String(valueAtPath(row, effective.listTitlePath) ?? "")}</strong><span>{String(valueAtPath(row, effective.listSubtitlePath) ?? "")}</span></li>)}</ul>; }
  if (effective.type === "gauge") { const min = effective.min ?? 0, max = effective.max ?? 100, value = Number(raw), percentage = Math.max(0, Math.min(100, (value - min) / (max - min) * 100)); content = <div className="widget-gauge" style={{ background: `conic-gradient(${effective.style.accent} ${percentage}%,#ffffff18 0)` }}><span>{formatValue(raw, effective.format, effective.suffix)}</span></div>; }
  if (effective.type === "chart") { const values = (Array.isArray(raw) ? raw : [raw]).map(Number).filter(Number.isFinite); const max = Math.max(...values, 1), points = values.map((value, index) => `${values.length === 1 ? 50 : index / (values.length - 1) * 100},${100 - value / max * 90}`).join(" "); content = <svg className="widget-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={effective.style.accent} strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg>; }
  return <article draggable={interactive} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={interactive ? onSelect : undefined} className={`canvas-widget animation-${effective.animation ?? "none"}${selected ? " selected" : ""}${interactive ? "" : " preview-only"}`} style={{ gridColumn: `${effective.x + 1} / span ${effective.width}`, gridRow: `${effective.y + 1} / span ${effective.height}`, background: effective.style.background, color: effective.style.foreground, textAlign: effective.style.align }}>
    <small>{effective.title}</small><div className="widget-value">{content}</div>
    {interactive && selected && (["n", "ne", "e", "se", "s", "sw", "w", "nw"] as ResizeDirection[]).map((direction) => <button draggable={false} aria-label={`Größe ${direction}`} className={`resize-handle resize-${direction}`} key={direction} onDragStart={(event) => event.preventDefault()} onPointerDown={(event) => onResizeStart(event, direction)}/>)}
  </article>;
}

export function CanvasStage({ document, page, selectedId, data, mode, device, leftOpen, rightOpen, dragging, placement, displayUrl, notice, onMode, onDevice, onToggleLeft, onToggleRight, onSelect, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onResizeStart, onSwitchPage }: {
  document: DashboardDocument; page: DashboardPage; selectedId: string; data: Record<string, unknown>;
  mode: "edit" | "preview"; device: PreviewDevice; leftOpen: boolean; rightOpen: boolean; dragging: boolean;
  placement: Placement | null; displayUrl: string; notice: { kind: "ok" | "error"; text: string } | null;
  onMode: (mode: "edit" | "preview") => void; onDevice: (device: PreviewDevice) => void;
  onToggleLeft: () => void; onToggleRight: () => void; onSelect: (id: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, widget: Widget) => void; onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void; onDragLeave: () => void; onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>, widget: Widget, direction: ResizeDirection) => void;
  onSwitchPage: (direction: number) => void;
}) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  return <section className={`canvas-workspace ${mode === "preview" ? "preview-mode" : ""}`}>
    <header className="canvas-toolbar">
      <div className="toolbar-group">
        <button className="icon-button" onClick={onToggleLeft} aria-label="Linkes Panel umschalten" title="Linkes Panel"><Icon name="panel-left"/></button>
        <span className="toolbar-divider"/>
        <span className="page-context"><small>Seite</small><strong>{page.name}</strong></span>
      </div>
      <div className="toolbar-center">
        <span className="segmented canvas-mode">
          <button className={mode === "edit" ? "active" : ""} onClick={() => onMode("edit")}><Icon name="edit"/> Bearbeiten</button>
          <button className={mode === "preview" ? "active" : ""} onClick={() => onMode("preview")}><Icon name="preview"/> Vorschau</button>
        </span>
        {mode === "preview" && <span className="segmented device-switcher">{(Object.keys(devices) as PreviewDevice[]).map((key) => <button className={device === key ? "active" : ""} key={key} onClick={() => onDevice(key)}>{devices[key].label}</button>)}</span>}
      </div>
      <div className="toolbar-group toolbar-right">
        <span className="live-status"><i/> Live Preview</span>
        <button className="fit-indicator" title="Artboard ist an den verfügbaren Bereich angepasst"><Icon name="fit"/> Fit</button>
        {displayUrl && <div className="share-control"><button className="icon-button" aria-label="Display-Link teilen" onClick={() => setShareOpen((open) => !open)}><Icon name="share"/></button>{shareOpen && <div className="share-popover"><strong>Client-URL</strong><code>{displayUrl}</code><button className="secondary-button full" onClick={() => navigator.clipboard.writeText(displayUrl)}><Icon name="copy"/> Kopieren</button></div>}</div>}
        <button className="icon-button" onClick={onToggleRight} aria-label="Inspector umschalten" title="Inspector"><Icon name="panel-right"/></button>
      </div>
    </header>
    <div className="stage-viewport">
      <div className={`artboard-frame device-${device}${dragging ? " dragging" : ""}`} style={{ aspectRatio: mode === "preview" ? devices[device].ratio : "16 / 9" }} onPointerDown={mode === "preview" ? (event) => { swipeStart.current = { x: event.clientX, y: event.clientY }; } : undefined} onPointerUp={mode === "preview" ? (event) => { const start = swipeStart.current; swipeStart.current = null; if (!start) return; const dx = event.clientX - start.x, dy = event.clientY - start.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) onSwitchPage(dx < 0 ? 1 : -1); } : undefined}>
        <div className="display-grid" onDragOver={mode === "edit" ? onDragOver : undefined} onDragLeave={mode === "edit" ? (event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragLeave(); } : undefined} onDrop={mode === "edit" ? onDrop : undefined} style={{ background: document.settings.background, color: document.settings.foreground, gridTemplateColumns: `repeat(${document.settings.columns}, 1fr)`, gridTemplateRows: `repeat(${document.settings.rows}, 1fr)` }}>
          {page.widgets.map((widget) => <CanvasWidget key={widget.id} widget={widget} data={data} interactive={mode === "edit"} selected={mode === "edit" && widget.id === selectedId} onSelect={() => onSelect(widget.id)} onDragStart={(event) => onDragStart(event, widget)} onDragEnd={onDragEnd} onResizeStart={(event, direction) => onResizeStart(event, widget, direction)}/>)}
          {document.pages.length > 1 && document.pageNavigation.visible && <div className="page-navigation" style={{ gridColumn: `${document.pageNavigation.x + 1} / span ${document.pageNavigation.width}`, gridRow: `${document.pageNavigation.y + 1} / span ${document.pageNavigation.height}`, background: document.pageNavigation.style.background, color: document.pageNavigation.style.foreground }}><button onClick={() => onSwitchPage(-1)} aria-label="Vorherige Seite"><Icon name="chevron-left"/></button><span>{document.pages.findIndex((item) => item.id === page.id) + 1} / {document.pages.length}</span><button onClick={() => onSwitchPage(1)} aria-label="Nächste Seite"><Icon name="chevron-right"/></button></div>}
          {mode === "edit" && placement && <div className={`placement-preview${placement.valid ? "" : " invalid"}`} style={{ gridColumn: `${placement.x + 1} / span ${placement.width}`, gridRow: `${placement.y + 1} / span ${placement.height}` }}><span>{placement.valid ? `${placement.width} × ${placement.height}` : "Belegt"}</span></div>}
        </div>
      </div>
      {mode === "preview" && <span className="device-size-label">{devices[device].label} · {devices[device].size}</span>}
    </div>
    {notice && <div className={`studio-notice ${notice.kind}`}>{notice.text}</div>}
  </section>;
}
