"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardDocument } from "../lib/dashboard";
import { starterCustomUi, starterThemeOnly, validateCustomUi, type CustomUiDocument } from "../lib/custom-ui";
import { DashboardRenderer } from "./display/DashboardRenderer";

export default function CustomUiStudio({ document, data, onDocument, onNotice, onClose }: {
  document: DashboardDocument; data: Record<string, unknown>;
  onDocument: (patch: Partial<DashboardDocument>) => void; onNotice: (text: string, ok: boolean) => void; onClose: () => void;
}) {
  const initial = useMemo(() => document.customUi ?? starterThemeOnly(), [document.customUi]);
  const [source, setSource] = useState(() => JSON.stringify(initial, null, 2));
  const [preview, setPreview] = useState<CustomUiDocument>(initial);
  const [error, setError] = useState("");
  useEffect(() => { setSource(JSON.stringify(document.customUi ?? starterThemeOnly(), null, 2)); }, [document.customUi]);

  const parse = (text: string) => {
    try {
      const next = JSON.parse(text) as CustomUiDocument;
      const errors = validateCustomUi(next, new Set(document.pages.map((page) => page.id)));
      if (errors.length) throw new Error(errors.join("\n"));
      setPreview(next); setError(""); return next;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Ungültiges JSON"); return null; }
  };
  const change = (text: string) => { setSource(text); parse(text); };
  const apply = () => { const next = parse(source); if (!next) return; onDocument({ customUi: next }); onNotice("Custom UI übernommen.", true); };
  const load = (next: CustomUiDocument) => { setSource(JSON.stringify(next, null, 2)); setPreview(next); setError(""); };
  const enabled = preview.enabled;

  return <section className="custom-ui-studio">
    <header className="custom-ui-studio-head"><div><small>Pro-Modus</small><h2>Custom UI JSON</h2><p>Deklaratives Layout für Web und Display – ohne ausführbaren Code.</p></div><div><button className="secondary-button" onClick={onClose}>Zurück</button><button className="primary-button" disabled={!!error} onClick={apply}>Übernehmen</button></div></header>
    <div className="custom-ui-studio-body">
      <div className="custom-ui-editor-pane">
        <div className="custom-ui-editor-toolbar"><strong>ui.json</strong><span className={error ? "invalid" : "valid"}>{error ? "Fehler" : "Valide"}</span><button onClick={() => load(starterThemeOnly())}>Theme laden</button><button onClick={() => load(starterCustomUi(document.pages[0].id))}>Layout laden</button></div>
        <textarea spellCheck={false} value={source} onChange={(event) => change(event.target.value)} aria-label="Custom UI JSON" />
        {error && <pre className="custom-ui-errors">{error}</pre>}
        <p className="custom-ui-hint"><code>pages</code> ist optional: ohne Seiten wird nur das bestehende Dashboard gestaltet. Mit Seiten: column, row, grid, card, text, value, image, spacer, button.</p>
      </div>
      <div className="custom-ui-preview-pane"><div className="custom-ui-preview-label"><strong>Live Preview</strong><span>{enabled ? preview.pages && Object.keys(preview.pages).length ? "Custom Layout" : "Theme only" : "Deaktiviert"}</span></div><div className="custom-ui-preview-frame"><DashboardRenderer document={{ ...document, customUi: preview }} pageIndex={0} runtime={Object.fromEntries(Object.entries(data).map(([id, value]) => [id, { value }]))} onPageChange={() => {}} /></div></div>
    </div>
  </section>;
}
