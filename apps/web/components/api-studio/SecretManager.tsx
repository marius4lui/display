"use client";

import { useEffect, useState } from "react";
import { Icon } from "../studio/Icons";

export function SecretManager({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (token: string) => void }) {
  const [secrets, setSecrets] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const load = () => fetch("/api/secrets").then((response) => response.ok ? response.json() : { secrets: [] }).then((result: { secrets: Array<{ id: string; name: string }> }) => setSecrets(result.secrets));
  useEffect(() => { if (open) void load(); }, [open]);
  if (!open) return null;
  const save = async () => {
    if (!name || !value) return;
    const response = await fetch("/api/secrets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, value }) });
    if (response.ok) { setName(""); setValue(""); await load(); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="secret-dialog" role="dialog" aria-modal="true" aria-labelledby="secret-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="dialog-icon"><Icon name="secrets"/></span><div><h2 id="secret-title">Secret Store</h2><p>Werte sind nach dem Speichern nicht mehr lesbar.</p></div></div><button className="icon-button" onClick={onClose} aria-label="Schließen"><Icon name="close"/></button></header>
      <div className="secret-create"><label>Name<input placeholder="API_TOKEN" value={name} onChange={(event) => setName(event.target.value.replace(/[^A-Za-z0-9_]/g, ""))}/></label><label>Wert<input type="password" placeholder="Write-only" value={value} onChange={(event) => setValue(event.target.value)}/></label><button className="primary-button" disabled={!name || !value} onClick={() => void save()}>Secret speichern</button></div>
      <div className="secret-list"><h3>Gespeicherte Secrets <span>{secrets.length}</span></h3>{secrets.length === 0 && <div className="section-empty">Noch keine Secrets gespeichert.</div>}{secrets.map((secret) => <div key={secret.id}><span><Icon name="secrets"/><code>{`{{secret.${secret.name}}}`}</code></span><button className="secondary-button" onClick={() => { onInsert(`{{secret.${secret.name}}}`); onClose(); }}>Einfügen</button></div>)}</div>
    </section>
  </div>;
}
