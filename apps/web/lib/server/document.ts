export function parseDashboardDocument(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dashboard-Dokument fehlt");
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 3) throw new Error("Dashboard-Schema wird nicht unterstützt");
  if (typeof item.name !== "string" || !item.name.trim()) throw new Error("Dashboard-Name fehlt");
  if (!item.settings || typeof item.settings !== "object") throw new Error("Dashboard-Einstellungen fehlen");
  if (!Array.isArray(item.pages) || item.pages.length < 1) throw new Error("Dashboard benötigt mindestens eine Seite");
  if (!Array.isArray(item.dataSources)) throw new Error("Datenquellen sind ungültig");
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
