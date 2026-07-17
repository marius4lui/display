"use client";

import { useEffect, useMemo, useState } from "react";

export default function PairAppLaunch({ dashboardUrl, pairingToken }: { dashboardUrl: string; pairingToken: string }) {
  const [message, setMessage] = useState("Die display-App wird geöffnet …");
  const appLink = useMemo(() => {
    try {
      const dashboard = new URL(dashboardUrl);
      if (!/^https?:$/.test(dashboard.protocol) || !/^[A-Za-z0-9_-]{32,128}$/.test(pairingToken)) return "";
      const link = new URL("display://pair");
      link.searchParams.set("url", dashboard.toString());
      link.searchParams.set("token", pairingToken);
      return link.toString();
    } catch { return ""; }
  }, [dashboardUrl, pairingToken]);

  useEffect(() => {
    if (!appLink) { setMessage("Dieser QR-Code ist ungültig."); return; }
    const timer = window.setTimeout(() => { window.location.href = appLink; }, 250);
    return () => window.clearTimeout(timer);
  }, [appLink]);

  return <main className="auth-screen"><section className="auth-card">
    <div className="brand"><span className="brand-mark">d</span><div><strong>display</strong><small>Gerätefreigabe</small></div></div>
    <h1>Display verbinden</h1>
    <p>{message}</p>
    {appLink && <a className="button primary" href={appLink}>display-App öffnen</a>}
    <p>Falls die App nicht startet, installiere oder aktualisiere die display-App und öffne diesen QR-Code erneut.</p>
  </section></main>;
}
