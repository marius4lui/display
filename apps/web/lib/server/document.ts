export function parseDashboardDocument(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dashboard-Dokument fehlt");
  const item = value as Record<string, unknown>;
  if (![3, 4, 5].includes(Number(item.schemaVersion))) throw new Error("Dashboard-Schema wird nicht unterstützt");
  if (typeof item.name !== "string" || !item.name.trim()) throw new Error("Dashboard-Name fehlt");
  if (!item.settings || typeof item.settings !== "object") throw new Error("Dashboard-Einstellungen fehlen");
  if (!Array.isArray(item.pages) || item.pages.length < 1) throw new Error("Dashboard benötigt mindestens eine Seite");
  if (!Array.isArray(item.dataSources)) throw new Error("Datenquellen sind ungültig");
  if (Number(item.schemaVersion) >= 4 && !Array.isArray(item.actions)) throw new Error("Aktionen sind ungültig");
  const ids = new Set<string>();
  for (const source of item.dataSources as Array<Record<string, unknown>>) {
    if (typeof source.id !== "string" || !source.id || ids.has(source.id)) throw new Error("Datenquellen benötigen eindeutige IDs");
    ids.add(source.id);
    if (source.type === "home_assistant" || source.type === "n8n" || source.type === "immich") {
      if (typeof source.integrationId !== "string" || !/^[0-9a-f-]{36}$/i.test(source.integrationId)) throw new Error("Integrations-Datenquelle ist ungültig");
    }
    if (source.type === "immich" && (typeof source.albumId !== "string" || !/^[0-9a-f-]{36}$/i.test(source.albumId))) throw new Error("Immich-Album ist ungültig");
  }
  const actionIds = new Set<string>();
  for (const raw of (item.actions ?? []) as Array<Record<string, unknown>>) {
    if (typeof raw.id !== "string" || !raw.id || actionIds.has(raw.id)) throw new Error("Aktionen benötigen eindeutige IDs");
    actionIds.add(raw.id);
    if (typeof raw.integrationId !== "string" || !/^[0-9a-f-]{36}$/i.test(raw.integrationId)) throw new Error("Action-Integration ist ungültig");
    if (!["n8n_webhook", "home_assistant_service"].includes(String(raw.operation))) throw new Error("Action-Operation wird nicht unterstützt");
    if (raw.cooldownMs !== undefined && (!Number.isFinite(raw.cooldownMs) || Number(raw.cooldownMs) < 0 || Number(raw.cooldownMs) > 3_600_000)) throw new Error("Action-Cooldown ist ungültig");
    if (raw.timeoutMs !== undefined && (!Number.isFinite(raw.timeoutMs) || Number(raw.timeoutMs) < 1000 || Number(raw.timeoutMs) > 20_000)) throw new Error("Action-Timeout muss zwischen 1 und 20 Sekunden liegen");
    if (raw.responseSourceId !== undefined && !ids.has(String(raw.responseSourceId))) throw new Error("Action-Antwortdatenquelle ist ungültig");
  }
  for (const source of item.dataSources as Array<Record<string, unknown>>) if (source.type === "action_response" && !actionIds.has(String(source.actionId))) throw new Error("Action-Antwortdatenquelle verweist auf keine Action");
  for (const page of item.pages as Array<Record<string, unknown>>) for (const raw of (page.widgets ?? []) as Array<Record<string, unknown>>) {
    if (raw.type === "button" && (typeof raw.actionId !== "string" || !actionIds.has(raw.actionId))) throw new Error("Button verweist auf keine vorhandene Action");
    if (raw.type === "immich_album" && (typeof raw.dataSourceId !== "string" || !ids.has(raw.dataSourceId))) throw new Error("Immich-Widget verweist auf keine vorhandene Datenquelle");
  }
  for (const source of item.dataSources as Array<Record<string, unknown>>) {
    const auth = source.auth as Record<string, unknown> | undefined;
    for (const value of [auth?.value, auth?.username, auth?.password]) {
      if (typeof value === "string" && value && !value.includes("{{secret.") && !value.includes("{{var.")) throw new Error("Zugangsdaten müssen über Secret-Referenzen eingebunden werden");
    }
  }
  const byteSize = new TextEncoder().encode(JSON.stringify(item)).byteLength;
  if (byteSize > 12 * 1024 * 1024) throw new Error("Dashboard-Dokument ist zu groß");
  return item;
}
