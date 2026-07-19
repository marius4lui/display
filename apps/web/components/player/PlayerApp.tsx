"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { DashboardRenderer, type RuntimeState } from "../display/DashboardRenderer";
import type { DashboardDocument, DataSource, Widget } from "../../lib/dashboard";
import { createSilkKeepAwake, isSilkUserAgent, type SilkKeepAwake } from "../../lib/client/silkKeepAwake";

type PlayerConfig = { id: string; version: number; publishedAt: string; document: DashboardDocument };
type Cache = { config?: PlayerConfig; runtime?: Record<string, RuntimeState>; savedAt?: string };
const CACHE_KEY = "last-player-state";

function openCache() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("display-player", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readCache(): Promise<Cache> {
  try {
    const db = await openCache();
    return await new Promise((resolve) => {
      const request = db.transaction("state").objectStore("state").get(CACHE_KEY);
      request.onsuccess = () => resolve(request.result ?? {});
      request.onerror = () => resolve({});
    });
  } catch { return {}; }
}
async function writeCache(config: PlayerConfig | null, runtime: Record<string, RuntimeState>) {
  if (!config) return;
  try {
    const safe: PlayerConfig = structuredClone(config);
    safe.document.dataSources = [];
    const db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction("state", "readwrite").objectStore("state").put({ config: safe, runtime, savedAt: new Date().toISOString() }, CACHE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch { /* Der Online-Player funktioniert auch ohne persistenten Browser-Speicher. */ }
}
async function clearCache() {
  try {
    const db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction("state", "readwrite").objectStore("state").delete(CACHE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch { /* Ein nicht verfügbarer Cache verhindert das Trennen nicht. */ }
}

function diagnostic(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "Zeitüberschreitung beim Abruf der Datenquelle.";
  if (error instanceof TypeError) return "Der Display-Server ist nicht erreichbar.";
  return error instanceof Error ? error.message : "Unbekannter Datenquellenfehler";
}

function appendHistory(history: unknown[], value: unknown) {
  const next = [...history, value].slice(-30);
  while (next.length > 1 && new TextEncoder().encode(JSON.stringify(next)).byteLength > 2 * 1024 * 1024) next.shift();
  return next;
}

export default function PlayerApp() {
  const [paired, setPaired] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [pairError, setPairError] = useState("");
  const [startupError, setStartupError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [config, setConfig] = useState<PlayerConfig | null>(null);
  const [configEpoch, setConfigEpoch] = useState(0);
  const configRef = useRef<PlayerConfig | null>(null);
  const [runtime, setRuntime] = useState<Record<string, RuntimeState>>({});
  const runtimeRef = useRef<Record<string, RuntimeState>>({});
  const [page, setPage] = useState(0);
  const [offline, setOffline] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const silkKeepAwake = useRef<SilkKeepAwake | null>(null);
  const isSilk = typeof navigator !== "undefined" && isSilkUserAgent(navigator.userAgent);
  const etag = useRef("");
  const configLoading = useRef(false);
  const lastSync = useRef<string | null>(null);
  const lastData = useRef<string | null>(null);
  const lastError = useRef<string | null>(null);
  const actionLocks = useRef<Record<string, number>>({});

  const updateRuntime = useCallback((sourceId: string, state: RuntimeState) => {
    setRuntime((current) => {
      const next = { ...current, [sourceId]: { ...current[sourceId], ...state } };
      runtimeRef.current = next;
      void writeCache(configRef.current, next);
      return next;
    });
  }, []);
  const markRuntimeStale = useCallback(() => {
    setRuntime((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([id, state]) => [id, { ...state, stale: true }]));
      runtimeRef.current = next;
      void writeCache(configRef.current, next);
      return next;
    });
  }, []);

  const loadConfig = useCallback(async (initial = false) => {
    if (configLoading.current) return;
    configLoading.current = true;
    try {
      const response = await fetch("/api/player/config", { headers: etag.current ? { "If-None-Match": etag.current } : {} });
      if (response.status === 401) {
        await clearCache();
        setPaired(false); setConfig(null); configRef.current = null; setRuntime({}); runtimeRef.current = {}; setStartupError(""); setSyncError("");
        return;
      }
      if (response.status === 304) { setPaired(true); setOffline(false); setSyncError(""); lastSync.current = new Date().toISOString(); return; }
      if (!response.ok) throw new Error((await response.json()).error?.message ?? "Konfiguration konnte nicht geladen werden");
      const next = await response.json() as PlayerConfig;
      etag.current = response.headers.get("etag") ?? "";
      const sourceIds = new Set(next.document.dataSources.map((source) => source.id));
      const retainedRuntime = Object.fromEntries(Object.entries(runtimeRef.current).filter(([sourceId]) => sourceIds.has(sourceId)));
      runtimeRef.current = retainedRuntime;
      setRuntime(retainedRuntime);
      configRef.current = next;
      setConfig(next);
      setConfigEpoch((epoch) => epoch + 1);
      setPaired(true); setOffline(false); setStartupError(""); setSyncError(""); setPage((value) => Math.max(0, Math.min(value, next.document.pages.length - 1)));
      lastSync.current = new Date().toISOString();
      await writeCache(next, retainedRuntime);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Konfigurationsfehler";
      const disconnected = !navigator.onLine || error instanceof TypeError;
      setOffline(disconnected); setSyncError(message); lastError.current = message;
      if (disconnected) markRuntimeStale();
      if (initial) {
        const cached = await readCache();
        if (cached.config) {
          const staleRuntime = Object.fromEntries(Object.entries(cached.runtime ?? {}).map(([id, state]) => [id, { ...state, stale: true }]));
          configRef.current = cached.config; setConfig(cached.config); setRuntime(staleRuntime); runtimeRef.current = staleRuntime; setPaired(true);
        }
        else setStartupError(message);
      }
    } finally { configLoading.current = false; }
  }, [markRuntimeStale]);

  useEffect(() => { setOffline(!navigator.onLine); void loadConfig(true); }, [loadConfig]);
  useEffect(() => {
    const online = () => { setOffline(false); void loadConfig(); };
    const offlineHandler = () => { setOffline(true); markRuntimeStale(); };
    const focused = () => void loadConfig();
    const visible = () => { if (document.visibilityState === "visible") void loadConfig(); };
    window.addEventListener("online", online); window.addEventListener("offline", offlineHandler);
    window.addEventListener("focus", focused); document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", online); window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("focus", focused); document.removeEventListener("visibilitychange", visible);
    };
  }, [loadConfig, markRuntimeStale]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "m") setMenu((open) => !open); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const changed = () => setIsFullscreen(!!document.fullscreenElement);
    changed();
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!config || !isSilk) return;
    const keepAwake = createSilkKeepAwake();
    silkKeepAwake.current = keepAwake;
    if (!keepAwake) return;

    const activate = () => void keepAwake.activate();
    const resume = () => {
      if (document.visibilityState === "visible") keepAwake.resume();
    };
    document.addEventListener("pointerdown", activate);
    document.addEventListener("keydown", activate);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);

    return () => {
      document.removeEventListener("pointerdown", activate);
      document.removeEventListener("keydown", activate);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      keepAwake.destroy();
      if (silkKeepAwake.current === keepAwake) silkKeepAwake.current = null;
    };
  }, [config?.id, isSilk]);
  useEffect(() => {
    if (!config || document.fullscreenElement || !document.fullscreenEnabled) return;
    void document.documentElement.requestFullscreen().catch(() => {});
  }, [config?.version]);
  useEffect(() => {
    if (!config) return;
    const timer = window.setInterval(() => void loadConfig(), Math.max(10, config.document.settings.configPollSeconds) * 1000);
    return () => clearInterval(timer);
  }, [config?.version, config?.document.settings.configPollSeconds, loadConfig]);

  useEffect(() => {
    if (!config || offline || !config.document.dataSources.length) return;
    const controllers = new Set<AbortController>();
    const run = async (source: DataSource) => {
      const controller = new AbortController(); controllers.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(`/api/player/data/${encodeURIComponent(source.id)}`, { method: "POST", signal: controller.signal, cache: "no-store", headers: { "X-Player-Config-Version": String(config.version) } });
        const result = await response.json() as { value?: unknown; checkedAt?: string; error?: { message?: string } };
        if (response.status === 409) void loadConfig();
        if (!response.ok) throw new Error(result.error?.message ?? `Datenquelle antwortet mit HTTP ${response.status}.`);
        const value = result.value;
        const previous = runtimeRef.current[source.id];
        const history = appendHistory(previous?.history ?? [], value);
        const completedAt = result.checkedAt ?? new Date().toISOString();
        updateRuntime(source.id, { value, history, error: undefined, stale: false, checkedAt: completedAt, succeededAt: completedAt });
        lastData.current = completedAt; lastError.current = null;
      } catch (error) {
        const message = diagnostic(error); lastError.current = `${source.name}: ${message}`;
        updateRuntime(source.id, { error: message, stale: true, checkedAt: new Date().toISOString() });
      } finally { clearTimeout(timeout); controllers.delete(controller); }
    };
    const timers = config.document.dataSources.filter((source) => source.type !== "action_response").map((source) => {
      void run(source);
      return window.setInterval(() => void run(source), Math.max(10, source.refreshSeconds ?? config.document.settings.dataPollSeconds) * 1000);
    });
    return () => { timers.forEach(clearInterval); controllers.forEach((controller) => controller.abort()); };
  }, [configEpoch, offline, loadConfig, updateRuntime]);

  useEffect(() => {
    if (!paired) return;
    const send = () => void fetch("/api/player/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      appVersion: "web-1", platformVersion: navigator.userAgent, dashboardVersion: configRef.current?.version,
      lastSyncAt: lastSync.current, lastDataAt: lastData.current, lastError: lastError.current,
    }) }).then(async (response) => { if (response.status === 401) { await clearCache(); setPaired(false); setConfig(null); configRef.current = null; setRuntime({}); runtimeRef.current = {}; } }).catch(() => {});
    send(); const timer = window.setInterval(send, 60_000); return () => clearInterval(timer);
  }, [paired]);

  async function pair(event: FormEvent) {
    event.preventDefault(); setPairError("");
    try {
      const response = await fetch("/api/player/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      if (!response.ok) { const result = await response.json(); setPairError(result.error?.message ?? "Kopplung fehlgeschlagen"); return; }
      setCode(""); await loadConfig(true);
    } catch { setPairError("Der Player ist derzeit nicht erreichbar."); }
  }
  async function disconnect() {
    try {
      const response = await fetch("/api/player/disconnect", { method: "POST" });
      if (!response.ok) throw new Error();
      await clearCache();
      setConfig(null); configRef.current = null; setRuntime({}); runtimeRef.current = {}; setPaired(false); setMenu(false);
    } catch { setNotice("Die Verbindung konnte nicht getrennt werden. Bitte Netzwerk prüfen."); window.setTimeout(() => setNotice(""), 3500); }
  }
  async function runAction(widget: Widget) {
    const action = configRef.current?.document.actions?.find((item) => item.id === widget.actionId);
    if (!action || !configRef.current) return;
    if ((actionLocks.current[action.id] ?? 0) > Date.now()) return;
    if (action.confirmation !== false && !window.confirm(`${action.name} ausführen?`)) return;
    const cooldownMs = Math.max(0, action.cooldownMs ?? 2000);
    actionLocks.current[action.id] = Date.now() + cooldownMs;
    const stateKey = `action:${action.id}`; const idempotencyKey = crypto.randomUUID();
    updateRuntime(stateKey, { value: "Wird ausgeführt …", stale: false });
    try {
      const response = await fetch(`/api/player/actions/${encodeURIComponent(action.id)}`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey, "X-Player-Config-Version": String(configRef.current.version) } });
      const result = await response.json() as { status?: string; message?: string; refreshSourceIds?: string[]; responseSourceId?: string; responseValue?: unknown; error?: { message?: string } };
      if (!response.ok) throw new Error(result.status === "rate_limited" ? "Bitte kurz warten." : result.error?.message ?? "Aktion fehlgeschlagen.");
      updateRuntime(stateKey, { value: result.message ?? "Erfolgreich", error: undefined });
      if (result.responseSourceId) updateRuntime(result.responseSourceId, { value: result.responseValue, stale: false, error: undefined, checkedAt: new Date().toISOString(), succeededAt: new Date().toISOString() });
      if (result.refreshSourceIds?.length) setConfigEpoch((epoch) => epoch + 1);
    } catch (error) { updateRuntime(stateKey, { error: error instanceof Error ? error.message : "Aktion fehlgeschlagen" }); }
    finally {
      window.setTimeout(() => {
        delete actionLocks.current[action.id];
        updateRuntime(stateKey, { value: undefined, error: undefined });
      }, Math.max(0, actionLocks.current[action.id] - Date.now()));
    }
  }
  async function fullscreen() {
    const keepAwakePromise = silkKeepAwake.current?.activate();
    try {
      if (!document.fullscreenEnabled) throw new Error();
      const fullscreenPromise = document.documentElement.requestFullscreen();
      await Promise.all([fullscreenPromise, keepAwakePromise]);
      setMenu(false);
    }
    catch { setNotice("Vollbild muss durch eine direkte Nutzeraktion erlaubt werden."); window.setTimeout(() => setNotice(""), 3500); }
  }

  if (startupError && !config) return <main className="player-pair"><div className="player-card"><div className="brand"><span className="brand-mark">d</span><div><strong>display</strong><small>Web Player</small></div></div><h1>Player nicht erreichbar</h1><p>{startupError}</p><button className="primary-button full" onClick={() => { setStartupError(""); void loadConfig(true); }}>Erneut versuchen</button></div></main>;
  if (paired === null) return <main className="player-pair"><div className="player-card"><span className="player-spinner" /><p>Player wird geladen …</p></div></main>;
  if (!paired || !config) return <main className="player-pair"><form className="player-card" onSubmit={pair}><div className="brand"><span className="brand-mark">d</span><div><strong>display</strong><small>Web Player</small></div></div><h1>Display verbinden</h1><p>Gib den sechsstelligen Code aus der Geräteverwaltung im Studio ein.</p><label htmlFor="pair-code">Kopplungscode</label><input id="pair-code" className="player-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />{pairError && <p className="player-error" role="alert">{pairError}</p>}<button className="primary-button full" disabled={code.length !== 6}>Verbinden</button><a className="player-download" href="/download/android">Android-App herunterladen <span>Neueste Version · APK</span></a></form></main>;

  return <main className="web-player">
    <div className="player-artboard"><DashboardRenderer key={`${config.id}:${config.version}:${configEpoch}`} document={config.document} pageIndex={page} runtime={runtime} onPageChange={setPage} onAction={(widget) => void runAction(widget)} /></div>
    <button className="player-menu-hotspot" aria-label="Player-Menü öffnen" onClick={() => setMenu(true)} />
    {!isFullscreen && <button className="player-fullscreen-button" onClick={() => void fullscreen()}>Vollbild aktivieren</button>}
    {(offline || syncError || Object.values(runtime).some((state) => state.stale)) && <div className="player-status">{offline ? "Offline · letzter Stand" : syncError ? `Synchronisation: ${syncError}` : "Daten teilweise veraltet"}</div>}
    {menu && <div className="player-menu-backdrop" onClick={() => setMenu(false)}><section className="player-menu" onClick={(event) => event.stopPropagation()}><strong>Player</strong><button onClick={() => void fullscreen()}>Vollbild</button><button className="danger-outline" onClick={() => void disconnect()}>Verbindung trennen</button><small>Menü: obere rechte Ecke oder Strg + Umschalt + M</small></section></div>}
    {notice && <div className="player-notice">{notice}</div>}
  </main>;
}
