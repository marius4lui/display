"use client";

import { useMemo, useState, type DragEvent } from "react";
import type { DashboardDocument, DataSource, WidgetType } from "../../lib/dashboard";
import { Icon, WidgetIcon } from "./Icons";

export type Activity = "widgets" | "pages" | "layers" | "data" | "project";
export type ProjectSection = "general" | "navigation" | "templates" | "devices" | "danger";
export type DashboardSummary = { id: string; name: string; activeVersion: number | null; updatedAt: string };
export type DeviceSummary = { id: string; name: string; online: boolean; last_seen_at?: string; app_version?: string; platform_version?: string; dashboard_version?: number; last_error?: string; revoked_at?: string };
export type PairingQr = { dataUrl: string; launchUrl: string; expiresAt: string };
export type VersionSummary = { version: number; contentHash: string; byteSize: number; publishedAt: string; active: boolean };
export type TemplateEntry = { name: string; category: string; description: string; create: () => DashboardDocument };

const activities: Array<{ id: Activity; label: string }> = [
  { id: "widgets", label: "Widgets" },
  { id: "pages", label: "Seiten" },
  { id: "layers", label: "Ebenen" },
  { id: "data", label: "Daten" },
  { id: "project", label: "Projekt" },
];

const widgetMeta: Record<WidgetType, { label: string; description: string; group: "Inhalt" | "Daten" | "Visualisierung" }> = {
  text: { label: "Text", description: "Überschriften und Hinweise", group: "Inhalt" },
  image: { label: "Bild", description: "Bild aus einer URL", group: "Inhalt" },
  clock: { label: "Uhr", description: "Lokale Zeit anzeigen", group: "Inhalt" },
  value: { label: "API-Wert", description: "Ein Feld aus einer Response", group: "Daten" },
  metric: { label: "Metrik", description: "Kompakter Kennzahlenwert", group: "Daten" },
  status: { label: "Status", description: "Zustand mit Farbcodierung", group: "Daten" },
  list: { label: "Liste", description: "Mehrere Response-Einträge", group: "Daten" },
  chart: { label: "Chart", description: "Zeitlicher Datenverlauf", group: "Visualisierung" },
  gauge: { label: "Gauge", description: "Wert auf einer Skala", group: "Visualisierung" },
  weather: { label: "Wetter", description: "Temperatur und Wetterlage", group: "Visualisierung" },
};

export function ActivityRail({ activity, onChange }: { activity: Activity; onChange: (activity: Activity) => void }) {
  return <nav className="activity-rail" aria-label="Studio-Bereiche">
    <div className="rail-brand">d</div>
    {activities.map((item) => <button className={activity === item.id ? "active" : ""} key={item.id} onClick={() => onChange(item.id)} aria-label={item.label} title={item.label}><Icon name={item.id}/><span>{item.label}</span></button>)}
  </nav>;
}

export function ContextPanel({
  activity, document, activePageId, selectedId, dashboards, devices, versions, dashboardId, pairingCode, pairingQr,
  templates, customTemplates, dataStatus, busy, onAddWidget, onWidgetDragStart, onDragEnd,
  onSelectPage, onAddPage, onDuplicatePage, onMovePage, onDeletePage, onRenamePage,
  onSelectWidget, onAddSource, onOpenSource, onSelectDashboard, onPatchDocument,
  onApplyTemplate, onApplyCustomTemplate, onSaveTemplate, onLoadDraft, onPair, onRevokeDevice, onDeleteDashboard, onActivateVersion,
}: {
  activity: Activity;
  document: DashboardDocument;
  activePageId: string;
  selectedId: string;
  dashboards: DashboardSummary[];
  devices: DeviceSummary[];
  versions: VersionSummary[];
  dashboardId: string;
  pairingCode: string;
  pairingQr: PairingQr | null;
  templates: TemplateEntry[];
  customTemplates: Array<{ name: string; document: DashboardDocument }>;
  dataStatus: Record<string, boolean>;
  busy: boolean;
  onAddWidget: (type: WidgetType) => void;
  onWidgetDragStart: (event: DragEvent<HTMLButtonElement>, type: WidgetType) => void;
  onDragEnd: () => void;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onDuplicatePage: () => void;
  onMovePage: (direction: number) => void;
  onDeletePage: () => void;
  onRenamePage: (name: string) => void;
  onSelectWidget: (id: string) => void;
  onAddSource: () => void;
  onOpenSource: (id?: string) => void;
  onSelectDashboard: (id: string) => void;
  onPatchDocument: (patch: Partial<DashboardDocument>) => void;
  onApplyTemplate: (template: TemplateEntry) => void;
  onApplyCustomTemplate: (document: DashboardDocument) => void;
  onSaveTemplate: () => void;
  onLoadDraft: () => void;
  onPair: () => void;
  onRevokeDevice: (id: string) => void;
  onDeleteDashboard: () => void;
  onActivateVersion: (version: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [projectSection, setProjectSection] = useState<ProjectSection>("general");
  const activePage = document.pages.find((page) => page.id === activePageId) ?? document.pages[0];
  const patchNavigation = (next: DashboardDocument["pageNavigation"]) => {
    const inBounds = next.x >= 0 && next.y >= 0 && next.width > 0 && next.height > 0 && next.x + next.width <= document.settings.columns && next.y + next.height <= document.settings.rows;
    const free = document.pages.every((page) => !page.widgets.some((item) => item.x < next.x + next.width && item.x + item.width > next.x && item.y < next.y + next.height && item.y + item.height > next.y));
    if (inBounds && free) onPatchDocument({ pageNavigation: next });
  };
  const widgetsByGroup = useMemo(() => (["Inhalt", "Daten", "Visualisierung"] as const).map((group) => ({
    group,
    widgets: (Object.keys(widgetMeta) as WidgetType[]).filter((type) => widgetMeta[type].group === group && `${widgetMeta[type].label} ${widgetMeta[type].description}`.toLowerCase().includes(search.toLowerCase())),
  })), [search]);

  return <aside className="context-panel">
    <header><div><small>Studio</small><h2>{activities.find((item) => item.id === activity)?.label}</h2></div><span className="panel-count">{activity === "widgets" ? 10 : activity === "pages" ? document.pages.length : activity === "layers" ? activePage.widgets.length : activity === "data" ? document.dataSources.length : ""}</span></header>
    <div className="context-scroll">
      {activity === "widgets" && <>
        <label className="search-box"><Icon name="search"/><input placeholder="Widgets suchen" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
        {widgetsByGroup.map(({ group, widgets }) => widgets.length > 0 && <section className="library-group" key={group}><h3>{group}</h3>{widgets.map((type) => <button className="widget-library-row" draggable key={type} onDragStart={(event) => onWidgetDragStart(event, type)} onDragEnd={onDragEnd} onClick={() => onAddWidget(type)}>
          <span className="widget-type-icon"><WidgetIcon type={type}/></span>
          <span><strong>{widgetMeta[type].label}</strong><small>{widgetMeta[type].description}</small></span>
          <i aria-hidden="true"><Icon name="drag"/></i>
        </button>)}</section>)}
      </>}

      {activity === "pages" && <>
        <button className="primary-button full" onClick={onAddPage}><Icon name="plus"/> Seite hinzufügen</button>
        <div className="page-list">{document.pages.map((page, index) => <button className={page.id === activePage.id ? "active" : ""} key={page.id} onClick={() => onSelectPage(page.id)}>
          <span className="page-number">{index + 1}</span>
          <span><strong>{page.name}</strong><small>{page.widgets.length} Widget{page.widgets.length === 1 ? "" : "s"}</small></span>
          {page.id === activePage.id && <i>Aktiv</i>}
        </button>)}</div>
        <section className="panel-section">
          <label>Seitenname<input value={activePage.name} onChange={(event) => onRenamePage(event.target.value)}/></label>
          <div className="page-tools">
            <button title="Duplizieren" onClick={onDuplicatePage}><Icon name="duplicate"/> Duplizieren</button>
            <button title="Nach oben" onClick={() => onMovePage(-1)}><Icon name="up"/></button>
            <button title="Nach unten" onClick={() => onMovePage(1)}><Icon name="down"/></button>
            <button className="subtle-danger" disabled={document.pages.length === 1} title="Löschen" onClick={onDeletePage}><Icon name="trash"/></button>
          </div>
        </section>
      </>}

      {activity === "layers" && <div className="layer-list">
        {activePage.widgets.length === 0 && <div className="panel-empty"><Icon name="layers"/><strong>Leere Seite</strong><p>Füge ein Widget hinzu, um die erste Ebene zu erstellen.</p></div>}
        {activePage.widgets.map((widget, index) => <button className={widget.id === selectedId ? "active" : ""} key={widget.id} onClick={() => onSelectWidget(widget.id)}>
          <span className="layer-index">{String(index + 1).padStart(2, "0")}</span><span className="widget-type-icon"><WidgetIcon type={widget.type}/></span><span><strong>{widget.title}</strong><small>{widget.type} · {widget.width} × {widget.height}</small></span>
        </button>)}
      </div>}

      {activity === "data" && <>
        <button className="primary-button full" onClick={onAddSource}><Icon name="plus"/> Datenquelle hinzufügen</button>
        <div className="source-list">{document.dataSources.map((source) => {
          let host = "Keine URL";
          try { host = new URL(source.url).host || "Keine URL"; } catch {}
          return <button key={source.id} onClick={() => onOpenSource(source.id)}>
            <span className={`method-badge method-${source.method.toLowerCase()}`}>{source.method}</span>
            <span><strong>{source.name}</strong><small>{host}</small></span>
            <i className={dataStatus[source.id] === true ? "status-ok" : dataStatus[source.id] === false ? "status-error" : "status-idle"} title={dataStatus[source.id] === true ? "Letzter Test erfolgreich" : dataStatus[source.id] === false ? "Letzter Test fehlgeschlagen" : "Noch nicht getestet"}/>
          </button>;
        })}</div>
        {document.dataSources.length === 0 && <div className="panel-empty"><Icon name="data"/><strong>Noch keine Datenquelle</strong><p>Verbinde eine REST API und ordne Response-Felder deinen Widgets zu.</p></div>}
        {document.dataSources.length > 0 && <button className="secondary-button full" onClick={() => onOpenSource()}><Icon name="data"/> Im API Studio öffnen</button>}
      </>}

      {activity === "project" && <>
        <nav className="subnav" aria-label="Projektbereiche">
          {([["general", "Allgemein"], ["navigation", "Navigation"], ["templates", "Vorlagen"], ["devices", "Geräte"], ["danger", "Gefahr"]] as const).map(([id, label]) => <button className={projectSection === id ? "active" : ""} key={id} onClick={() => setProjectSection(id)}>{label}</button>)}
        </nav>
        {projectSection === "general" && <div className="form-stack">
          <section className="panel-section"><h3>Dashboard</h3><label>Projekt<select value={dashboardId} disabled={busy} onChange={(event) => onSelectDashboard(event.target.value)}><option value="">+ Neues Dashboard</option>{dashboards.map((item) => <option value={item.id} key={item.id}>{item.name}{item.activeVersion ? ` · Live v${item.activeVersion}` : " · Entwurf"}</option>)}</select></label><label>Name<input value={document.name} onChange={(event) => onPatchDocument({ name: event.target.value })}/></label>{dashboardId && <button className="secondary-button" onClick={onLoadDraft}>Gespeicherten Entwurf laden</button>}</section>
          {dashboardId && <section className="panel-section"><h3>Veröffentlichte Versionen</h3>{versions.length === 0 ? <div className="section-empty">Noch keine Version veröffentlicht.</div> : <div className="version-list">{versions.map((item) => <div key={item.version}><span><strong>Version {item.version}</strong><small>{new Date(item.publishedAt).toLocaleString("de-DE")} · {item.byteSize.toLocaleString("de-DE")} B</small></span>{item.active ? <i>Aktiv</i> : <button className="secondary-button" onClick={() => onActivateVersion(item.version)}>Aktivieren</button>}</div>)}</div>}</section>}
          <section className="panel-section"><h3>Darstellung & Polling</h3><label className="color-field"><span>Hintergrund</span><span className="color-control"><input type="color" value={document.settings.background} onChange={(event) => onPatchDocument({ settings: { ...document.settings, background: event.target.value } })}/><input value={document.settings.background} onChange={(event) => onPatchDocument({ settings: { ...document.settings, background: event.target.value } })}/></span></label><div className="control-pair"><label>Konfiguration (s)<input type="number" min="10" value={document.settings.configPollSeconds} onChange={(event) => onPatchDocument({ settings: { ...document.settings, configPollSeconds: Number(event.target.value) } })}/></label><label>Daten (s)<input type="number" min="10" value={document.settings.dataPollSeconds} onChange={(event) => onPatchDocument({ settings: { ...document.settings, dataPollSeconds: Number(event.target.value) } })}/></label></div></section>
        </div>}
        {projectSection === "navigation" && <div className="form-stack"><section className="panel-section"><h3>Seitennavigation</h3><label className="switch-row"><span><strong>Navigation anzeigen</strong><small>Ab zwei Seiten auf dem Display</small></span><input type="checkbox" checked={document.pageNavigation.visible} onChange={(event) => onPatchDocument({ pageNavigation: { ...document.pageNavigation, visible: event.target.checked } })}/></label><div className="layout-grid">{(["x", "y", "width", "height"] as const).map((key) => <label key={key}><span>{key.toUpperCase()}</span><input type="number" value={document.pageNavigation[key]} onChange={(event) => patchNavigation({ ...document.pageNavigation, [key]: Number(event.target.value) })}/></label>)}</div><div className="control-pair"><label>Fläche<input type="color" value={document.pageNavigation.style.background} onChange={(event) => onPatchDocument({ pageNavigation: { ...document.pageNavigation, style: { ...document.pageNavigation.style, background: event.target.value } } })}/></label><label>Pfeile<input type="color" value={document.pageNavigation.style.foreground} onChange={(event) => onPatchDocument({ pageNavigation: { ...document.pageNavigation, style: { ...document.pageNavigation.style, foreground: event.target.value } } })}/></label></div></section></div>}
        {projectSection === "templates" && <div className="template-list"><button className="secondary-button full" onClick={onSaveTemplate}><Icon name="plus"/> Aktuelles Dashboard speichern</button>{templates.map((template) => <button className="template-row" key={template.name} onClick={() => onApplyTemplate(template)}><span><strong>{template.name}</strong><small>{template.description}</small></span><i>{template.category}</i></button>)}{customTemplates.map((template, index) => <button className="template-row" key={`${template.name}-${index}`} onClick={() => onApplyCustomTemplate(template.document)}><span><strong>{template.name}</strong><small>Persönliche Vorlage ohne Zugangsdaten</small></span><i>Eigen</i></button>)}</div>}
        {projectSection === "devices" && <div className="form-stack">
          {!dashboardId ? <div className="panel-empty"><Icon name="project"/><strong>Dashboard speichern</strong><p>Geräte können verbunden werden, sobald das Dashboard gespeichert ist.</p></div> : <>
            <section className="panel-section"><h3>Gerät koppeln</h3><p className="section-note">QR-Code mit der Kamera scannen. Die sichere Web-Seite öffnet anschließend die display-App; die Anmeldung ist einmalig zehn Minuten gültig.</p><button className="primary-button full" disabled={busy} onClick={onPair}>QR-Code fürs Handy erzeugen</button>{pairingQr && <div className="pairing-qr"><img src={pairingQr.dataUrl} alt={`QR-Code für ${document.name}`}/><strong>Mit der display-App scannen</strong><small>Öffnet die Web-Übergabe und meldet das Gerät anschließend automatisch an.</small><small>Gültig bis {new Date(pairingQr.expiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.</small><a href={pairingQr.launchUrl}>Auf diesem Gerät öffnen</a></div>}{pairingCode && <div className="pairing-code"><small>Fallback-Code</small><strong>{pairingCode}</strong></div>}</section>
            <section className="device-list"><h3>Gekoppelte Geräte <span>{devices.length}</span></h3>{devices.length === 0 && <div className="section-empty">Noch keine Geräte gekoppelt.</div>}{devices.map((device) => <article className="device-card" key={device.id}><header><span className={device.online ? "device-online" : "device-offline"}/><div><strong>{device.name}</strong><small>{device.online ? "Online" : "Offline"}{device.last_seen_at ? ` · ${new Date(device.last_seen_at).toLocaleString("de-DE")}` : ""}</small></div></header><dl><div><dt>App</dt><dd>{device.app_version || "—"}</dd></div><div><dt>Android</dt><dd>{device.platform_version || "—"}</dd></div><div><dt>Dashboard</dt><dd>{device.dashboard_version ? `v${device.dashboard_version}` : "—"}</dd></div></dl>{device.last_error && <p>{device.last_error}</p>}{!device.revoked_at && <button className="danger-outline" onClick={() => onRevokeDevice(device.id)}>Zugriff widerrufen</button>}</article>)}</section>
          </>}
        </div>}
        {projectSection === "danger" && <section className="panel-section danger-zone"><h3>Dashboard löschen</h3><p>Entfernt alle Versionen, Pairings und Geräteverbindungen dauerhaft.</p><button className="danger-outline full" disabled={!dashboardId} onClick={onDeleteDashboard}><Icon name="trash"/> Dashboard endgültig löschen</button></section>}
      </>}
    </div>
  </aside>;
}
