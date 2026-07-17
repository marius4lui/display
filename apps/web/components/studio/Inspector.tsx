"use client";

import type { DashboardDocument, DashboardPage, Widget } from "../../lib/dashboard";
import { placementIsFree } from "../../lib/dashboard";
import { Icon, WidgetIcon } from "./Icons";
import { RuleEditor } from "./RuleEditor";

const dataTypes: Widget["type"][] = ["value", "weather", "metric", "status", "list", "chart", "gauge"];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field">
    <span>{label}</span>
    <span className="color-control">
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)}/>
      <input value={value} maxLength={7} onChange={(event) => onChange(event.target.value)}/>
    </span>
  </label>;
}

export function Inspector({ document, page, selected, onPatch, onDelete, onDuplicate, onNotice, onOpenData }: {
  document: DashboardDocument;
  page: DashboardPage;
  selected?: Widget;
  onPatch: (patch: Partial<Widget>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onNotice: (text: string) => void;
  onOpenData: () => void;
}) {
  if (!selected) return <aside className="studio-inspector">
    <div className="inspector-empty"><div className="empty-illustration"><Icon name="settings"/></div><strong>Nichts ausgewählt</strong><p>Wähle ein Widget auf dem Artboard oder in den Ebenen aus.</p></div>
  </aside>;

  const patchStyle = (patch: Partial<Widget["style"]>) => onPatch({ style: { ...selected.style, ...patch } });
  const dataWidget = dataTypes.includes(selected.type);

  return <aside className="studio-inspector">
    <header className="inspector-header">
      <span className="widget-type-icon"><WidgetIcon type={selected.type}/></span>
      <div><small>{selected.type}</small><input aria-label="Widget-Titel" value={selected.title} onChange={(event) => onPatch({ title: event.target.value })}/></div>
      <button className="icon-button" aria-label="Widget duplizieren" onClick={onDuplicate}><Icon name="duplicate"/></button>
      <button className="icon-button subtle-danger" aria-label="Widget löschen" onClick={onDelete}><Icon name="trash"/></button>
    </header>
    <div className="inspector-scroll">
      <section className="inspector-section">
        <h3>Inhalt</h3>
        {selected.type === "text" && <label>Text<textarea value={selected.staticValue ?? ""} onChange={(event) => onPatch({ staticValue: event.target.value })}/></label>}
        {selected.type === "image" && <label>Bild-URL<input value={selected.imageUrl ?? ""} onChange={(event) => onPatch({ imageUrl: event.target.value })}/></label>}
        {selected.type === "clock" && <p className="section-note">Die Uhr verwendet automatisch die lokale Gerätezeit.</p>}
        {dataWidget && <p className="section-note">Der angezeigte Inhalt kommt aus der verknüpften Datenquelle.</p>}
      </section>

      {dataWidget && <section className="inspector-section">
        <h3>Datenbindung</h3>
        {document.dataSources.length ? <>
          <label>Datenquelle
            <select value={selected.dataSourceId ?? ""} onChange={(event) => onPatch({ dataSourceId: event.target.value })}>
              <option value="">Auswählen …</option>
              {document.dataSources.map((source) => <option value={source.id} key={source.id}>{source.name}</option>)}
            </select>
          </label>
          <label>JSON-Pfad<input className="mono-input" value={selected.jsonPath ?? ""} onChange={(event) => onPatch({ jsonPath: event.target.value })}/></label>
          <button className="secondary-button full" onClick={onOpenData}><Icon name="data"/> Feld aus Response auswählen</button>
          <div className="control-pair">
            <label>Format<select value={selected.format ?? "text"} onChange={(event) => onPatch({ format: event.target.value as Widget["format"] })}><option value="text">Text</option><option value="number">Zahl</option><option value="date">Datum</option><option value="temperature">Temperatur</option></select></label>
            <label>Suffix<input value={selected.suffix ?? ""} onChange={(event) => onPatch({ suffix: event.target.value })}/></label>
          </div>
        </> : <div className="section-empty"><strong>Keine Datenquelle</strong><span>Lege zuerst im API Studio eine Datenquelle an.</span><button className="secondary-button" onClick={onOpenData}>API Studio öffnen</button></div>}
        {selected.type === "list" && <><label>Titelpfad<input className="mono-input" value={selected.listTitlePath ?? ""} onChange={(event) => onPatch({ listTitlePath: event.target.value })}/></label><label>Untertitelpfad<input className="mono-input" value={selected.listSubtitlePath ?? ""} onChange={(event) => onPatch({ listSubtitlePath: event.target.value })}/></label><label>Maximale Einträge<input type="number" min="1" value={selected.maxItems ?? 5} onChange={(event) => onPatch({ maxItems: Number(event.target.value) })}/></label></>}
        {selected.type === "gauge" && <div className="control-pair"><label>Minimum<input type="number" value={selected.min ?? 0} onChange={(event) => onPatch({ min: Number(event.target.value) })}/></label><label>Maximum<input type="number" value={selected.max ?? 100} onChange={(event) => onPatch({ max: Number(event.target.value) })}/></label></div>}
        {selected.type === "chart" && <><label>Diagramm<select value={selected.chartType ?? "line"} onChange={(event) => onPatch({ chartType: event.target.value as Widget["chartType"] })}><option value="line">Linie</option><option value="bar">Balken</option><option value="sparkline">Sparkline</option></select></label><label>Historie (Tage)<input type="number" min="1" value={selected.historyDays ?? 1} onChange={(event) => onPatch({ historyDays: Number(event.target.value) })}/></label></>}
      </section>}

      <section className="inspector-section">
        <h3>Darstellung</h3>
        <ColorField label="Fläche" value={selected.style.background} onChange={(background) => patchStyle({ background })}/>
        <ColorField label="Text" value={selected.style.foreground} onChange={(foreground) => patchStyle({ foreground })}/>
        <ColorField label="Akzent" value={selected.style.accent} onChange={(accent) => patchStyle({ accent })}/>
        <label>Ausrichtung
          <span className="segmented">
            {(["left", "center", "right"] as const).map((align) => <button className={selected.style.align === align ? "active" : ""} key={align} onClick={() => patchStyle({ align })}>{align === "left" ? "Links" : align === "center" ? "Mitte" : "Rechts"}</button>)}
          </span>
        </label>
      </section>

      <section className="inspector-section">
        <h3>Verhalten</h3>
        <label>Animation<select value={selected.animation ?? "none"} onChange={(event) => onPatch({ animation: event.target.value as Widget["animation"] })}><option value="none">Keine</option><option value="pulse">Pulse</option><option value="float">Float</option><option value="glow">Glow</option></select></label>
        <label>Bei Fehler<select value={selected.errorBehavior} onChange={(event) => onPatch({ errorBehavior: event.target.value as Widget["errorBehavior"] })}><option value="stale">Letzten Wert zeigen</option><option value="empty">Leer anzeigen</option><option value="error">Fehler anzeigen</option></select></label>
        {dataWidget && <details className="inspector-disclosure">
          <summary>Bedingte Regeln <span>{selected.conditionalRules?.length ?? 0}</span></summary>
          <RuleEditor rules={selected.conditionalRules ?? []} onChange={(conditionalRules) => onPatch({ conditionalRules })}/>
        </details>}
      </section>

      <section className="inspector-section">
        <h3>Layout</h3>
        <p className="section-note">Direkt auf dem Artboard ziehen oder präzise Werte eingeben.</p>
        <div className="layout-grid">{(["x", "y", "width", "height"] as const).map((key) => <label key={key}><span>{key === "width" ? "B" : key === "height" ? "H" : key.toUpperCase()}</span><input type="number" min={key === "width" || key === "height" ? 1 : 0} value={selected[key]} onChange={(event) => {
          const value = Number(event.target.value);
          const next = { ...selected, [key]: value };
          if (placementIsFree(document, page, next, selected.id)) onPatch({ [key]: value });
          else onNotice("Position ist belegt oder außerhalb des Rasters.");
        }}/></label>)}</div>
      </section>

      <section className="inspector-section danger-zone">
        <h3>Danger Zone</h3>
        <button className="danger-outline full" onClick={onDelete}><Icon name="trash"/> Widget löschen</button>
      </section>
    </div>
  </aside>;
}
