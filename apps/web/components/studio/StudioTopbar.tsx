"use client";

import { Icon } from "./Icons";

export function StudioTopbar({ name, workspace, status, busy, onName, onWorkspace, onPreview, onSave, onPublish }: {
  name: string; workspace: "dashboard" | "api"; status: string; busy: boolean;
  onName: (name: string) => void; onWorkspace: (workspace: "dashboard" | "api") => void;
  onPreview: () => void; onSave: () => void; onPublish: () => void;
}) {
  return <header className="studio-topbar">
    <div className="topbar-brand"><span>d</span><strong>display</strong></div>
    <nav className="workspace-nav" aria-label="Arbeitsbereiche"><button className={workspace === "dashboard" ? "active" : ""} onClick={() => onWorkspace("dashboard")}>Dashboard</button><button className={workspace === "api" ? "active" : ""} onClick={() => onWorkspace("api")}>API Studio</button></nav>
    <span className="topbar-divider"/>
    <input className="project-name" aria-label="Dashboard-Name" value={name} onChange={(event) => onName(event.target.value)}/>
    <span className={`save-status ${status.startsWith("Ungespeichert") ? "dirty" : ""}`}><i/>{status}</span>
    <div className="topbar-actions">
      {workspace === "dashboard" && <button className="secondary-button" onClick={onPreview}><Icon name="preview"/> Preview</button>}
      <button className="secondary-button" disabled={busy} onClick={onSave}>Speichern</button>
      <button className="primary-button" disabled={busy} onClick={onPublish}>{busy ? "Bitte warten …" : "Veröffentlichen"}</button>
    </div>
  </header>;
}
