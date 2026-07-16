"use client";

import { useEffect, useState } from "react";

export default function DeviceConnect({ displayId, state }: { displayId: string; state: string }) {
  const [error, setError] = useState("");
  const [deepLink, setDeepLink] = useState("");
  useEffect(() => {
    if (!state) { setError("Die Verbindungsanfrage ist ungültig."); return; }
    fetch(`/api/dashboards/${displayId}/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error?.message ?? "Freigabe fehlgeschlagen"); setDeepLink(result.deepLink); location.href = result.deepLink; })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Freigabe fehlgeschlagen"));
  }, [displayId, state]);
  return <main className="auth-screen"><div className="auth-card"><div className="brand"><span className="brand-mark">d</span><div><strong>display</strong><small>Gerätefreigabe</small></div></div><h1>Display verbinden</h1>{error ? <><p>{error}</p><p>Öffne die App erneut und nutze dort den Kopplungscode.</p></> : <><p>Freigabe erfolgreich. Du wirst zurück zur App gebracht …</p>{deepLink && <a className="button primary" href={deepLink}>Zurück zur App</a>}</>}</div></main>;
}
