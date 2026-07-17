"use client";

import { useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { type DashboardDocument, type DashboardPage, type Widget } from "../../lib/dashboard";
import { DashboardRenderer, DisplayWidget } from "../display/DashboardRenderer";
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

function CanvasWidget({ widget, data, selected, interactive, onSelect, onDragStart, onDragEnd, onResizeStart }: {
  widget: Widget; data: Record<string, unknown>; selected: boolean; interactive: boolean;
  onSelect: () => void; onDragStart: (event: DragEvent<HTMLElement>) => void; onDragEnd: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>, direction: ResizeDirection) => void;
}) {
  return <DisplayWidget widget={widget} runtime={{ value: data[widget.dataSourceId ?? ""] }} className={`${selected ? "selected" : ""}${interactive ? "" : " preview-only"}`} articleProps={{ draggable: interactive, onDragStart, onDragEnd, onClick: interactive ? onSelect : undefined }}>
    {interactive && selected && (["n", "ne", "e", "se", "s", "sw", "w", "nw"] as ResizeDirection[]).map((direction) => <button draggable={false} aria-label={`Größe ${direction}`} className={`resize-handle resize-${direction}`} key={direction} onDragStart={(event) => event.preventDefault()} onPointerDown={(event) => onResizeStart(event, direction)}/>)}
  </DisplayWidget>;
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
      <div className={`artboard-frame device-${device}${dragging ? " dragging" : ""}`} style={{ aspectRatio: mode === "preview" ? devices[device].ratio : "16 / 9" }}>
        {mode === "preview" ? <DashboardRenderer document={document} pageIndex={document.pages.findIndex((item) => item.id === page.id)} runtime={Object.fromEntries(Object.entries(data).map(([id, value]) => [id, { value }]))} onPageChange={(index) => {
          const current = document.pages.findIndex((item) => item.id === page.id);
          onSwitchPage(index >= current ? index - current : index + document.pages.length - current);
        }} /> : <div className="display-grid" onDragOver={onDragOver} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragLeave(); }} onDrop={onDrop} style={{ background: document.settings.background, color: document.settings.foreground, gridTemplateColumns: `repeat(${document.settings.columns}, 1fr)`, gridTemplateRows: `repeat(${document.settings.rows}, 1fr)` }}>
          {page.widgets.map((widget) => <CanvasWidget key={widget.id} widget={widget} data={data} interactive={mode === "edit"} selected={mode === "edit" && widget.id === selectedId} onSelect={() => onSelect(widget.id)} onDragStart={(event) => onDragStart(event, widget)} onDragEnd={onDragEnd} onResizeStart={(event, direction) => onResizeStart(event, widget, direction)}/>)}
          {mode === "edit" && placement && <div className={`placement-preview${placement.valid ? "" : " invalid"}`} style={{ gridColumn: `${placement.x + 1} / span ${placement.width}`, gridRow: `${placement.y + 1} / span ${placement.height}` }}><span>{placement.valid ? `${placement.width} × ${placement.height}` : "Belegt"}</span></div>}
        </div>}
      </div>
      {mode === "preview" && <span className="device-size-label">{devices[device].label} · {devices[device].size}</span>}
    </div>
    {notice && <div className={`studio-notice ${notice.kind}`}>{notice.text}</div>}
  </section>;
}
