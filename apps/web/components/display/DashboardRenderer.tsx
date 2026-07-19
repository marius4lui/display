"use client";

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { effectiveWidget, formatValue, matchesRule, valueAtPath, type DashboardDocument, type Widget } from "../../lib/dashboard";

export interface RuntimeState {
  value?: unknown;
  history?: unknown[];
  error?: string;
  stale?: boolean;
  checkedAt?: string;
  succeededAt?: string;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return <>{now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</>;
}

type AlbumAsset = { id: string; originalFileName?: string; fileCreatedAt?: string; description?: string };

function ImmichAlbumWidget({ widget, raw }: { widget: Widget; raw: unknown }) {
  const assets = raw && typeof raw === "object" && Array.isArray((raw as { assets?: unknown[] }).assets)
    ? (raw as { assets: AlbumAsset[] }).assets.filter((asset) => asset && typeof asset.id === "string") : [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const current = assets[index % Math.max(assets.length, 1)];
  const change = (direction: number) => setIndex((value) => assets.length ? (value + direction + assets.length) % assets.length : 0);
  useEffect(() => { setIndex((value) => assets.length ? Math.min(value, assets.length - 1) : 0); }, [assets.length]);
  useEffect(() => {
    if (paused || assets.length < 2 || (widget.slideshowSeconds ?? 10) <= 0) return;
    const timer = window.setInterval(() => change(1), Math.max(2, widget.slideshowSeconds ?? 10) * 1000);
    return () => window.clearInterval(timer);
  }, [paused, assets.length, widget.slideshowSeconds]);
  useEffect(() => {
    if (assets.length < 2 || !widget.dataSourceId) return;
    const next = assets[(index + 1) % assets.length];
    const image = new Image(); image.src = `/api/player/images/${encodeURIComponent(widget.dataSourceId)}?assetId=${encodeURIComponent(next.id)}`;
  }, [assets, index, widget.dataSourceId]);
  if (!assets.length || !current || !widget.dataSourceId) return <span className="immich-empty">Album ist leer oder noch nicht geladen.</span>;
  const caption = current.description || current.originalFileName || "Foto";
  return <div className="immich-album" onClick={(event) => { event.stopPropagation(); setPaused((value) => !value); }} onPointerDown={(event) => { event.stopPropagation(); swipe.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => {
    event.stopPropagation(); const start = swipe.current; swipe.current = null; if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.25) change(dx < 0 ? 1 : -1);
  }}>
    <img src={`/api/player/images/${encodeURIComponent(widget.dataSourceId)}?assetId=${encodeURIComponent(current.id)}`} alt={caption} draggable={false} style={{ objectFit: widget.imageFit ?? "cover" }}/>
    {widget.showCaption !== false && <span className="immich-caption">{caption}</span>}
    <span className="immich-counter">{index + 1} / {assets.length}{paused ? " · Pause" : ""}</span>
    {assets.length > 1 && <><button type="button" className="immich-prev" aria-label="Vorheriges Foto" onClick={(event) => { event.stopPropagation(); change(-1); }}>‹</button><button type="button" className="immich-next" aria-label="Nächstes Foto" onClick={(event) => { event.stopPropagation(); change(1); }}>›</button></>}
  </div>;
}

function widgetContent(widget: Widget, raw: unknown, history: unknown[]): ReactNode {
  if (widget.type === "clock") return <Clock />;
  if (widget.type === "image") return widget.imageUrl ? <img src={widget.imageUrl} alt={widget.title} /> : "Bild-URL fehlt";
  if (widget.type === "immich_album") return <ImmichAlbumWidget widget={widget} raw={raw} />;
  if (widget.type === "button") return <>{widget.icon ? `${widget.icon} ` : ""}{raw ? String(raw) : widget.buttonLabel ?? widget.title}</>;
  if (["value", "metric"].includes(widget.type)) return formatValue(raw, widget.format, widget.suffix);
  if (widget.type === "weather") return <span className="widget-weather"><i>☀</i>{formatValue(raw, widget.format, widget.suffix)}</span>;
  if (widget.type === "status") {
    const state = widget.statusMap?.[String(raw)];
    return <span style={{ color: state?.color ?? widget.style.accent }}>{state?.icon ?? "●"} {state?.text ?? String(raw ?? "—")}</span>;
  }
  if (widget.type === "list") {
    const rows = Array.isArray(raw) ? raw.slice(0, widget.maxItems ?? 5) : [];
    return <ul className="widget-list">{rows.map((row, index) => <li key={index}><strong>{String(valueAtPath(row, widget.listTitlePath) ?? "")}</strong><span>{String(valueAtPath(row, widget.listSubtitlePath) ?? "")}</span></li>)}</ul>;
  }
  if (widget.type === "gauge") {
    const min = widget.min ?? 0, max = widget.max ?? 100, value = Number(raw);
    const percentage = Number.isFinite(value) ? Math.max(0, Math.min(100, (value - min) / (max - min) * 100)) : 0;
    return <div className="widget-gauge" style={{ background: `conic-gradient(${widget.style.accent} ${percentage}%,#ffffff18 0)` }}><span>{formatValue(raw, widget.format, widget.suffix)}</span></div>;
  }
  if (widget.type === "chart") {
    const samples = history.length ? history.map((sample) => valueAtPath(sample, widget.jsonPath)) : Array.isArray(raw) ? raw : [raw];
    const values = samples.map(Number).filter(Number.isFinite);
    const max = Math.max(...values, 1), min = Math.min(...values, 0), range = Math.max(1, max - min);
    if (widget.chartType === "bar") {
      const width = 90 / Math.max(values.length, 1);
      return <svg className="widget-chart" viewBox="0 0 100 100" preserveAspectRatio="none">{values.map((value, index) => {
        const height = (value - min) / range * 90;
        return <rect key={index} x={5 + index * width} y={95 - height} width={Math.max(1, width * .72)} height={height} fill={widget.style.accent} />;
      })}</svg>;
    }
    const points = values.map((value, index) => `${values.length === 1 ? 50 : index / (values.length - 1) * 100},${95 - (value - min) / range * 90}`).join(" ");
    return <svg className="widget-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} fill="none" stroke={widget.style.accent} strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>;
  }
  return widget.staticValue ?? widget.title;
}

export function DisplayWidget({ widget, runtime, className = "", children, articleProps, onAction }: { widget: Widget; runtime?: RuntimeState; className?: string; children?: ReactNode; articleProps?: HTMLAttributes<HTMLElement>; onAction?: (widget: Widget) => void }) {
  const raw = valueAtPath(runtime?.value, widget.jsonPath);
  const rule = widget.conditionalRules?.find((candidate) => matchesRule(raw, candidate));
  const effective = effectiveWidget(widget, raw);
  const hasError = !!runtime?.error;
  const hideValue = hasError && effective.errorBehavior === "empty";
  const showError = hasError && effective.errorBehavior === "error";
  const rendered = widgetContent(effective, raw, runtime?.history ?? []);
  const ruled = rule?.text || rule?.icon ? <>{rule.icon ? `${rule.icon} ` : ""}{rule.text ?? rendered}</> : rendered;
  const content = showError ? runtime?.error : hideValue ? "—" : ruled;
  const fontScale = Math.max(25, Math.min(300, effective.style.fontScale ?? 100)) / 100;
  return <article {...articleProps} role={effective.type === "button" ? "button" : articleProps?.role} tabIndex={effective.type === "button" ? 0 : articleProps?.tabIndex} onClick={effective.type === "button" && onAction ? () => onAction(effective) : articleProps?.onClick} onKeyDown={effective.type === "button" && onAction ? (event) => { if (event.key === "Enter" || event.key === " ") onAction(effective); } : articleProps?.onKeyDown} data-widget-type={effective.type} data-vertical-align={effective.style.verticalAlign ?? "center"} className={`canvas-widget animation-${effective.animation ?? "none"}${runtime?.stale ? " is-stale" : ""}${hasError ? " has-error" : ""} ${className}`} style={{ gridColumn: `${effective.x + 1} / span ${effective.width}`, gridRow: `${effective.y + 1} / span ${effective.height}`, background: effective.style.background, color: effective.style.foreground, textAlign: effective.style.align, "--widget-font-scale": fontScale } as CSSProperties}>
    <small>{effective.title}</small><div className="widget-value">{content}</div>
    {runtime?.stale && <span className="widget-state">Veraltet</span>}
    {children}
  </article>;
}

export function DashboardRenderer({ document, pageIndex, runtime, onPageChange, onAction, className = "" }: {
  document: DashboardDocument;
  pageIndex: number;
  runtime: Record<string, RuntimeState>;
  onPageChange: (index: number) => void;
  onAction?: (widget: Widget) => void;
  className?: string;
}) {
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const page = document.pages[Math.max(0, Math.min(pageIndex, document.pages.length - 1))] ?? document.pages[0];
  const change = (direction: number) => onPageChange((pageIndex + direction + document.pages.length) % document.pages.length);
  return <div className={`display-grid ${className}`} onPointerDown={(event) => { swipe.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => {
    const start = swipe.current; swipe.current = null; if (!start || document.pages.length < 2) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) change(dx < 0 ? 1 : -1);
  }} style={{ background: document.settings.background, color: document.settings.foreground, gridTemplateColumns: `repeat(${document.settings.columns}, 1fr)`, gridTemplateRows: `repeat(${document.settings.rows}, 1fr)` }}>
    {page.widgets.map((widget) => <DisplayWidget key={widget.id} widget={widget} runtime={runtime[widget.type === "button" ? `action:${widget.actionId}` : widget.dataSourceId ?? ""]} onAction={onAction} />)}
    {document.pages.length > 1 && document.pageNavigation.visible && <div className="page-navigation" style={{ gridColumn: `${document.pageNavigation.x + 1} / span ${document.pageNavigation.width}`, gridRow: `${document.pageNavigation.y + 1} / span ${document.pageNavigation.height}`, background: document.pageNavigation.style.background, color: document.pageNavigation.style.foreground }}>
      <button onClick={() => change(-1)} aria-label="Vorherige Seite">‹</button><span>{pageIndex + 1} / {document.pages.length}</span><button onClick={() => change(1)} aria-label="Nächste Seite">›</button>
    </div>}
  </div>;
}
