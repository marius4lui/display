"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import QRCode from "qrcode";
import {
  blankDashboard, createWidget, normalizeDashboard, placementIsFree, systemTemplates,
  type DashboardDocument, type DashboardPage, type DataSource, type LegacyDashboardDocument,
  type Widget, type WidgetType,
} from "../lib/dashboard";
import ApiWorkbench from "./ApiWorkbench";
import { CanvasStage, type Placement, type PreviewDevice, type ResizeDirection } from "./studio/CanvasStage";
import { ActivityRail, ContextPanel, type Activity, type DashboardSummary, type DeviceSummary, type PairingQr, type TemplateEntry, type VersionSummary } from "./studio/ContextPanel";
import { Inspector } from "./studio/Inspector";
import { StudioTopbar } from "./studio/StudioTopbar";

type Notice = { kind: "ok" | "error"; text: string } | null;
type JsonLeaf = { path: string; value: unknown };
type DragPayload = Placement & { grabX: number; grabY: number } & ({ kind: "existing"; id: string } | { kind: "new"; widgetType: WidgetType });

export default function Builder() {
  const initial = useMemo(() => blankDashboard(), []);
  const [document, setDocument] = useState<DashboardDocument>(initial);
  const [activePageId, setActivePageId] = useState(initial.pages[0].id);
  const [selectedId, setSelectedId] = useState(initial.pages[0].widgets[0]?.id ?? "");
  const [activity, setActivity] = useState<Activity>("widgets");
  const [dashboardId, setDashboardId] = useState("");
  const [displayUrl, setDisplayUrl] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingQr, setPairingQr] = useState<PairingQr | null>(null);
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({});
  const [dataStatus, setDataStatus] = useState<Record<string, boolean>>({});
  const [customTemplates, setCustomTemplates] = useState<Array<{ name: string; document: DashboardDocument }>>([]);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [studioMode, setStudioMode] = useState<"edit" | "preview">("edit");
  const [workspaceView, setWorkspaceView] = useState<"dashboard" | "api">("dashboard");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("display");
  const [apiSourceId, setApiSourceId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const loadedDashboardId = useRef("");

  const activePage = document.pages.find((page) => page.id === activePageId) ?? document.pages[0];
  const widgets = activePage.widgets;
  const selected = widgets.find((item) => item.id === selectedId);
  const activeSummary = dashboards.find((item) => item.id === dashboardId);
  const status = dirty ? "Ungespeichert" : activeSummary?.activeVersion ? `Live v${activeSummary.activeVersion}` : dashboardId ? "Gespeichert" : "Neuer Entwurf";

  useEffect(() => {
    try {
      const project = JSON.parse(localStorage.getItem("display-project") ?? "null") as { dashboardId?: string; displayUrl?: string } | null;
      if (project?.dashboardId) { setDashboardId(project.dashboardId); setDisplayUrl(project.displayUrl ?? ""); }
    } catch { localStorage.removeItem("display-project"); }
    try { setCustomTemplates(JSON.parse(localStorage.getItem("display-templates") ?? "[]")); }
    catch { localStorage.removeItem("display-templates"); }
  }, []);

  useEffect(() => {
    void fetch("/api/dashboards").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { dashboards: DashboardSummary[] };
      setDashboards(result.dashboards);
      if (dashboardId && !result.dashboards.some((item) => item.id === dashboardId)) {
        setDashboardId(""); setDisplayUrl(""); localStorage.removeItem("display-project");
      }
    });
  }, [dashboardId]);

  useEffect(() => {
    if (!dashboardId) { setDevices([]); return; }
    let active = true;
    const refreshDevices = () => fetch(`/api/dashboards/${dashboardId}/pairings`)
      .then((response) => response.ok ? response.json() : { devices: [] })
      .then((result: { devices: DeviceSummary[] }) => { if (active) setDevices(result.devices); });
    void refreshDevices();
    const interval = window.setInterval(refreshDevices, 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [dashboardId]);

  useEffect(() => {
    if (!pairingQr) return;
    const remaining = new Date(pairingQr.expiresAt).valueOf() - Date.now();
    if (remaining <= 0) { setPairingQr(null); setPairingCode(""); return; }
    const timeout = window.setTimeout(() => { setPairingQr(null); setPairingCode(""); }, remaining);
    return () => window.clearTimeout(timeout);
  }, [pairingQr]);

  const loadVersions = (id = dashboardId) => {
    if (!id) { setVersions([]); return; }
    void fetch(`/api/dashboards/${id}/versions`).then((response) => response.ok ? response.json() : { versions: [] }).then((result: { versions: VersionSummary[] }) => setVersions(result.versions));
  };
  useEffect(() => { loadVersions(); }, [dashboardId]);

  const mutateDocument = (update: (current: DashboardDocument) => DashboardDocument) => {
    setDocument((current) => update(current));
    setDirty(true);
  };
  const patchDocument = (patch: Partial<DashboardDocument>) => mutateDocument((current) => ({ ...current, ...patch }));
  const patchWidgets = (update: (items: Widget[]) => Widget[]) => mutateDocument((current) => ({ ...current, pages: current.pages.map((page) => page.id === activePageId ? { ...page, widgets: update(page.widgets) } : page) }));
  const patchWidget = (patch: Partial<Widget>) => patchWidgets((items) => items.map((item) => item.id === selectedId ? { ...item, ...patch } : item));
  const patchSource = (id: string, patch: Partial<DataSource>) => mutateDocument((current) => ({ ...current, dataSources: current.dataSources.map((source) => source.id === id ? { ...source, ...patch } : source) }));

  const applyDocument = (next: DashboardDocument, markDirty = true) => {
    setDocument(next);
    setActivePageId(next.pages[0].id);
    setSelectedId(next.pages[0].widgets[0]?.id ?? "");
    setDirty(markDirty);
  };

  const save = async (publish: boolean) => {
    setNotice(null); setBusy(true);
    try {
      let id = dashboardId;
      let url = displayUrl;
      if (!id) {
        const response = await fetch("/api/dashboards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document, name: document.name }) });
        if (!response.ok) throw new Error((await response.json()).error?.message ?? "Dashboard konnte nicht erstellt werden");
        const result = await response.json() as { id: string; displayUrl: string };
        id = result.id; url = result.displayUrl;
        setDashboardId(id); setDisplayUrl(url);
        setDashboards((current) => [{ id, name: document.name, activeVersion: null, updatedAt: new Date().toISOString() }, ...current]);
        localStorage.setItem("display-project", JSON.stringify({ dashboardId: id, displayUrl: url }));
      } else {
        const response = await fetch(`/api/dashboards/${id}/draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document, name: document.name }) });
        if (!response.ok) throw new Error((await response.json()).error?.message ?? "Entwurf konnte nicht gespeichert werden");
      }
      setDirty(false);
      if (publish) {
        const response = await fetch(`/api/dashboards/${id}/publish`, { method: "POST" });
        if (!response.ok) throw new Error((await response.json()).error?.message ?? "Veröffentlichung fehlgeschlagen");
        const result = await response.json() as { version: number };
        setDashboards((items) => items.map((item) => item.id === id ? { ...item, name: document.name, activeVersion: result.version, updatedAt: new Date().toISOString() } : item));
        loadVersions(id);
        setNotice({ kind: "ok", text: `Version ${result.version} ist live.` });
      } else {
        setDashboards((items) => items.map((item) => item.id === id ? { ...item, name: document.name, updatedAt: new Date().toISOString() } : item));
        setNotice({ kind: "ok", text: "Entwurf gespeichert." });
      }
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unbekannter Fehler" });
    } finally { setBusy(false); }
  };

  const loadDraft = async (id = dashboardId) => {
    if (!id) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/dashboards/${id}/draft`);
      if (!response.ok) throw new Error((await response.json()).error?.message ?? "Entwurf konnte nicht geladen werden");
      const result = await response.json() as { document: DashboardDocument | LegacyDashboardDocument };
      applyDocument(normalizeDashboard(result.document), false);
      setNotice({ kind: "ok", text: "Entwurf geladen." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Entwurf konnte nicht geladen werden" });
    } finally { setBusy(false); }
  };

  const selectDashboard = async (id: string) => {
    if (!id) {
      const next = blankDashboard();
      setDashboardId(""); setDisplayUrl(""); setPairingCode(""); setPairingQr(null); applyDocument(next, false);
      localStorage.removeItem("display-project");
      return;
    }
    loadedDashboardId.current = id;
    const url = `${location.origin}/d/${id}`;
    setDashboardId(id); setDisplayUrl(url); setPairingCode(""); setPairingQr(null);
    localStorage.setItem("display-project", JSON.stringify({ dashboardId: id, displayUrl: url }));
    await loadDraft(id);
  };

  useEffect(() => {
    if (dashboardId && loadedDashboardId.current !== dashboardId) {
      loadedDashboardId.current = dashboardId;
      void loadDraft(dashboardId);
    }
  // Loading is intentionally keyed only by the restored dashboard id.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId]);

  const deleteDashboard = async () => {
    if (!dashboardId || !confirm("Dashboard einschließlich aller Versionen und Geräte wirklich löschen?")) return;
    const response = await fetch(`/api/dashboards/${dashboardId}`, { method: "DELETE" });
    if (!response.ok) return setNotice({ kind: "error", text: "Dashboard konnte nicht gelöscht werden." });
    setDashboards((items) => items.filter((item) => item.id !== dashboardId));
    await selectDashboard("");
    setNotice({ kind: "ok", text: "Dashboard gelöscht." });
  };

  const createPairing = async () => {
    if (!dashboardId) return setNotice({ kind: "error", text: "Dashboard zuerst speichern." });
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/pairings`, { method: "POST" });
      const result = await response.json() as { code?: string; qrToken?: string; expiresAt?: string; displayUrl?: string; error?: { message?: string } };
      if (!response.ok || !result.code || !result.qrToken || !result.expiresAt || !result.displayUrl) throw new Error(result.error?.message ?? "Pairing fehlgeschlagen");
      const deepLink = new URL("display://pair");
      deepLink.searchParams.set("url", result.displayUrl);
      deepLink.searchParams.set("token", result.qrToken);
      const dataUrl = await QRCode.toDataURL(deepLink.toString(), {
        width: 360, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#090b12", light: "#ffffff" },
      });
      setPairingCode(result.code);
      setPairingQr({ dataUrl, deepLink: deepLink.toString(), expiresAt: result.expiresAt });
      setNotice({ kind: "ok", text: "QR-Code erstellt. Er ist einmalig und 10 Minuten gültig." });
    } catch (error) {
      setPairingQr(null);
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Pairing fehlgeschlagen" });
    } finally { setBusy(false); }
  };

  const templates = useMemo<TemplateEntry[]>(() => [{ name: "Leer", category: "Basis", description: "Leeres Dashboard", create: blankDashboard }, ...systemTemplates], []);
  const mapLeaf = (source: DataSource, leaf: JsonLeaf, create = false) => {
    if (create || !selected || !["value", "weather"].includes(selected.type)) {
      const item = createWidget("value", widgets.length);
      item.title = leaf.path.split(".").at(-1) || source.name;
      item.dataSourceId = source.id; item.jsonPath = leaf.path;
      let candidate: Widget | undefined;
      for (let y = 0; y <= document.settings.rows - item.height && !candidate; y++) {
        for (let x = 0; x <= document.settings.columns - item.width; x++) {
          const next = { ...item, x, y };
          if (placementIsFree(document, activePage, next)) { candidate = next; break; }
        }
      }
      if (!candidate) return setNotice({ kind: "error", text: "Kein freier Platz für das Widget." });
      patchWidgets((items) => [...items, candidate!]);
      setSelectedId(candidate.id);
    } else patchWidget({ dataSourceId: source.id, jsonPath: leaf.path });
    setNotice({ kind: "ok", text: `${leaf.path || "Antwort"} ist mit dem Widget verknüpft.` });
  };

  const addWidget = (type: WidgetType) => {
    const item = createWidget(type, widgets.length);
    for (let y = 0; y <= document.settings.rows - item.height; y++) for (let x = 0; x <= document.settings.columns - item.width; x++) {
      const candidate = { ...item, x, y };
      if (placementIsFree(document, activePage, candidate)) { patchWidgets((items) => [...items, candidate]); setSelectedId(candidate.id); return; }
    }
    setNotice({ kind: "error", text: "Kein freier Platz für dieses Widget." });
  };

  const beginLibraryDrag = (event: DragEvent<HTMLButtonElement>, type: WidgetType) => {
    const item = createWidget(type, widgets.length);
    event.dataTransfer.setData("application/x-display-widget-type", type);
    event.dataTransfer.effectAllowed = "copy";
    setDragPayload({ kind: "new", widgetType: type, x: 0, y: 0, width: item.width, height: item.height, grabX: 0, grabY: 0 });
    setDragging(true);
  };

  const beginWidgetDrag = (event: DragEvent<HTMLElement>, widget: Widget) => {
    event.dataTransfer.setData("application/x-display-widget", widget.id);
    event.dataTransfer.effectAllowed = "move";
    const itemRect = event.currentTarget.getBoundingClientRect();
    const gridRect = event.currentTarget.closest(".display-grid")?.getBoundingClientRect();
    const cellWidth = (gridRect?.width ?? itemRect.width) / document.settings.columns;
    const cellHeight = (gridRect?.height ?? itemRect.height) / document.settings.rows;
    setDragPayload({ kind: "existing", id: widget.id, x: widget.x, y: widget.y, width: widget.width, height: widget.height, grabX: Math.max(0, Math.min(widget.width - 1, Math.floor((event.clientX - itemRect.left) / cellWidth))), grabY: Math.max(0, Math.min(widget.height - 1, Math.floor((event.clientY - itemRect.top) / cellHeight))) });
    setDragging(true);
  };

  const finishDrag = () => { setDragging(false); setDragPayload(null); setPlacement(null); };
  const dragOverCanvas = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!dragPayload) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * document.settings.columns) - dragPayload.grabX;
    const y = Math.floor((event.clientY - rect.top) / rect.height * document.settings.rows) - dragPayload.grabY;
    const candidate = { x: Math.max(0, Math.min(document.settings.columns - dragPayload.width, x)), y: Math.max(0, Math.min(document.settings.rows - dragPayload.height, y)), width: dragPayload.width, height: dragPayload.height };
    setPlacement({ ...candidate, valid: placementIsFree(document, activePage, candidate, dragPayload.kind === "existing" ? dragPayload.id : undefined) });
  };
  const dropOnCanvas = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!placement?.valid) { setNotice({ kind: "error", text: "Widgets dürfen sich nicht überlappen." }); finishDrag(); return; }
    const widgetId = event.dataTransfer.getData("application/x-display-widget");
    const widgetType = event.dataTransfer.getData("application/x-display-widget-type") as WidgetType;
    if (widgetId) { patchWidgets((items) => items.map((item) => item.id === widgetId ? { ...item, x: placement.x, y: placement.y } : item)); setSelectedId(widgetId); }
    else if (widgetType) { const item = { ...createWidget(widgetType, widgets.length), x: placement.x, y: placement.y }; patchWidgets((items) => [...items, item]); setSelectedId(item.id); }
    finishDrag();
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, widget: Widget, direction: ResizeDirection) => {
    event.preventDefault(); event.stopPropagation();
    const grid = event.currentTarget.closest(".display-grid");
    if (!(grid instanceof HTMLElement)) return;
    const rect = grid.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY, widget: { ...widget } };
    setDragging(true);
    const move = (pointer: PointerEvent) => {
      const dx = Math.round((pointer.clientX - origin.x) / (rect.width / document.settings.columns));
      const dy = Math.round((pointer.clientY - origin.y) / (rect.height / document.settings.rows));
      const next = { x: origin.widget.x, y: origin.widget.y, width: origin.widget.width, height: origin.widget.height };
      if (direction.includes("e")) next.width = Math.max(1, Math.min(document.settings.columns - next.x, origin.widget.width + dx));
      if (direction.includes("s")) next.height = Math.max(1, Math.min(document.settings.rows - next.y, origin.widget.height + dy));
      if (direction.includes("w")) { next.x = Math.max(0, Math.min(origin.widget.x + origin.widget.width - 1, origin.widget.x + dx)); next.width = origin.widget.width + origin.widget.x - next.x; }
      if (direction.includes("n")) { next.y = Math.max(0, Math.min(origin.widget.y + origin.widget.height - 1, origin.widget.y + dy)); next.height = origin.widget.height + origin.widget.y - next.y; }
      setPlacement({ ...next, valid: placementIsFree(document, activePage, next, widget.id) });
      if (placementIsFree(document, activePage, next, widget.id)) patchWidgets((items) => items.map((item) => item.id === widget.id ? { ...item, ...next } : item));
    };
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); finishDrag(); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  };

  const navigationForPages = (pages: DashboardPage[]) => {
    const navigation = document.pageNavigation;
    const free = (x: number, y: number) => pages.every((page) => !page.widgets.some((item) => item.x < x + navigation.width && item.x + item.width > x && item.y < y + navigation.height && item.y + item.height > y));
    if (free(navigation.x, navigation.y)) return navigation;
    for (let y = 0; y <= document.settings.rows - navigation.height; y++) for (let x = 0; x <= document.settings.columns - navigation.width; x++) if (free(x, y)) return { ...navigation, x, y };
    return null;
  };
  const addPage = () => {
    const page: DashboardPage = { id: crypto.randomUUID(), name: `Seite ${document.pages.length + 1}`, widgets: [] };
    const pages = [...document.pages, page], pageNavigation = navigationForPages(pages);
    if (!pageNavigation) return setNotice({ kind: "error", text: "Für die Seitennavigation ist kein gemeinsamer freier Platz vorhanden." });
    patchDocument({ pages, pageNavigation }); setActivePageId(page.id); setSelectedId("");
  };
  const duplicatePage = () => {
    const page = { id: crypto.randomUUID(), name: `${activePage.name} Kopie`, widgets: activePage.widgets.map((item) => ({ ...structuredClone(item), id: crypto.randomUUID() })) };
    const pages = [...document.pages, page], pageNavigation = navigationForPages(pages);
    if (!pageNavigation) return setNotice({ kind: "error", text: "Für die Seitennavigation ist kein gemeinsamer freier Platz vorhanden." });
    patchDocument({ pages, pageNavigation }); setActivePageId(page.id); setSelectedId(page.widgets[0]?.id ?? "");
  };
  const movePage = (direction: number) => {
    const index = document.pages.findIndex((page) => page.id === activePage.id), target = index + direction;
    if (target < 0 || target >= document.pages.length) return;
    const pages = [...document.pages]; [pages[index], pages[target]] = [pages[target], pages[index]]; patchDocument({ pages });
  };
  const deletePage = () => {
    if (document.pages.length === 1 || !confirm(`Seite „${activePage.name}“ wirklich löschen?`)) return;
    const index = document.pages.findIndex((page) => page.id === activePage.id);
    const pages = document.pages.filter((page) => page.id !== activePage.id), next = pages[Math.min(index, pages.length - 1)];
    patchDocument({ pages }); setActivePageId(next.id); setSelectedId(next.widgets[0]?.id ?? "");
  };
  const duplicateWidget = () => {
    if (!selected) return;
    for (let y = 0; y <= document.settings.rows - selected.height; y++) for (let x = 0; x <= document.settings.columns - selected.width; x++) {
      const candidate = { ...structuredClone(selected), id: crypto.randomUUID(), title: `${selected.title} Kopie`, x, y };
      if (placementIsFree(document, activePage, candidate)) { patchWidgets((items) => [...items, candidate]); setSelectedId(candidate.id); return; }
    }
    setNotice({ kind: "error", text: "Kein freier Platz für die Kopie." });
  };
  const switchPage = (direction: number) => {
    const index = document.pages.findIndex((page) => page.id === activePage.id);
    const next = document.pages[(index + direction + document.pages.length) % document.pages.length];
    setActivePageId(next.id); setSelectedId(next.widgets[0]?.id ?? "");
  };
  const applyCustomTemplate = (template: DashboardDocument) => {
    const next = structuredClone(template);
    next.pages.forEach((page) => { page.id = crypto.randomUUID(); page.widgets.forEach((item) => { item.id = crypto.randomUUID(); }); });
    next.dataSources.forEach((source) => { const old = source.id; source.id = crypto.randomUUID(); next.pages.flatMap((page) => page.widgets).filter((widget) => widget.dataSourceId === old).forEach((widget) => { widget.dataSourceId = source.id; }); source.auth = { type: "none" }; });
    applyDocument(next);
  };
  const saveTemplate = () => {
    const clean = structuredClone(document); clean.dataSources.forEach((source) => { source.auth = { type: "none" }; });
    const next = [...customTemplates, { name: document.name, document: clean }];
    setCustomTemplates(next); localStorage.setItem("display-templates", JSON.stringify(next));
    setNotice({ kind: "ok", text: "Template ohne Zugangsdaten gespeichert." });
  };
  const openApi = (id?: string) => { if (id) setApiSourceId(id); setWorkspaceView("api"); };

  return <main className="builder-shell">
    <StudioTopbar name={document.name} workspace={workspaceView} status={status} busy={busy} onName={(name) => patchDocument({ name })} onWorkspace={setWorkspaceView} onPreview={() => { setStudioMode("preview"); setWorkspaceView("dashboard"); }} onSave={() => void save(false)} onPublish={() => void save(true)}/>
    {workspaceView === "api" ? <ApiWorkbench
      sources={document.dataSources}
      initialSourceId={apiSourceId}
      onAdd={() => { const id = crypto.randomUUID(); patchDocument({ dataSources: [...document.dataSources, { id, name: "Neue API", method: "GET", url: "https://", headers: {}, query: {}, variables: {}, auth: { type: "none" }, refreshSeconds: 60 }] }); return id; }}
      onPatch={patchSource}
      onRemove={(id) => patchDocument({ dataSources: document.dataSources.filter((source) => source.id !== id) })}
      onData={(id, data) => { setPreviewData((current) => ({ ...current, [id]: data })); setDataStatus((current) => ({ ...current, [id]: true })); }}
      onStatus={(id, ok) => setDataStatus((current) => ({ ...current, [id]: ok }))}
      onMap={mapLeaf}
      onClose={() => setWorkspaceView("dashboard")}
    /> : <section className={`studio-layout${leftOpen ? "" : " left-closed"}${rightOpen ? "" : " right-closed"}`}>
      <ActivityRail activity={activity} onChange={(next) => { setActivity(next); setLeftOpen(true); }}/>
      {leftOpen && <ContextPanel
        activity={activity} document={document} activePageId={activePage.id} selectedId={selectedId}
        dashboards={dashboards} devices={devices} versions={versions} dashboardId={dashboardId} pairingCode={pairingCode} pairingQr={pairingQr}
        templates={templates} customTemplates={customTemplates} dataStatus={dataStatus} busy={busy}
        onAddWidget={addWidget} onWidgetDragStart={beginLibraryDrag} onDragEnd={finishDrag}
        onSelectPage={(id) => { const page = document.pages.find((item) => item.id === id); if (page) { setActivePageId(id); setSelectedId(page.widgets[0]?.id ?? ""); } }}
        onAddPage={addPage} onDuplicatePage={duplicatePage} onMovePage={movePage} onDeletePage={deletePage}
        onRenamePage={(name) => mutateDocument((current) => ({ ...current, pages: current.pages.map((page) => page.id === activePage.id ? { ...page, name } : page) }))}
        onSelectWidget={setSelectedId}
        onAddSource={() => { const id = crypto.randomUUID(); patchDocument({ dataSources: [...document.dataSources, { id, name: "Neue API", method: "GET", url: "https://", headers: {}, query: {}, variables: {}, auth: { type: "none" }, refreshSeconds: 60 }] }); openApi(id); }}
        onOpenSource={openApi} onSelectDashboard={(id) => void selectDashboard(id)} onPatchDocument={patchDocument}
        onApplyTemplate={(template) => applyDocument(template.create())} onApplyCustomTemplate={applyCustomTemplate} onSaveTemplate={saveTemplate}
        onLoadDraft={() => void loadDraft()} onPair={() => void createPairing()}
        onRevokeDevice={(id) => void fetch(`/api/dashboards/${dashboardId}/devices/${id}`, { method: "DELETE" }).then((response) => { if (response.ok) setDevices((items) => items.filter((item) => item.id !== id)); })}
        onDeleteDashboard={() => void deleteDashboard()}
        onActivateVersion={(version) => void fetch(`/api/dashboards/${dashboardId}/versions/${version}/activate`, { method: "POST" }).then((response) => {
          if (!response.ok) { setNotice({ kind: "error", text: "Version konnte nicht aktiviert werden." }); return; }
          setVersions((items) => items.map((item) => ({ ...item, active: item.version === version })));
          setDashboards((items) => items.map((item) => item.id === dashboardId ? { ...item, activeVersion: version } : item));
          setNotice({ kind: "ok", text: `Version ${version} ist jetzt aktiv.` });
        })}
      />}
      <CanvasStage document={document} page={activePage} selectedId={selectedId} data={previewData} mode={studioMode} device={previewDevice}
        leftOpen={leftOpen} rightOpen={rightOpen} dragging={dragging} placement={placement} displayUrl={displayUrl} notice={notice}
        onMode={setStudioMode} onDevice={setPreviewDevice} onToggleLeft={() => setLeftOpen((open) => !open)} onToggleRight={() => setRightOpen((open) => !open)}
        onSelect={setSelectedId} onDragStart={beginWidgetDrag} onDragEnd={finishDrag} onDragOver={dragOverCanvas} onDragLeave={() => setPlacement(null)} onDrop={dropOnCanvas}
        onResizeStart={startResize} onSwitchPage={switchPage}/>
      {rightOpen && <Inspector document={document} page={activePage} selected={selected} onPatch={patchWidget}
        onDelete={() => { if (!selected || !confirm(`Widget „${selected.title}“ löschen?`)) return; patchWidgets((items) => items.filter((item) => item.id !== selected.id)); setSelectedId(""); }}
        onDuplicate={duplicateWidget} onNotice={(text) => setNotice({ kind: "error", text })} onOpenData={() => openApi(selected?.dataSourceId)}/>}
    </section>}
  </main>;
}
