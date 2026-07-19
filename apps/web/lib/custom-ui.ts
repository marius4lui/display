export type CustomUiNodeType = "column" | "row" | "grid" | "card" | "text" | "value" | "image" | "spacer" | "button";

export interface CustomUiStyle {
  background?: string; foreground?: string; accent?: string;
  padding?: number; gap?: number; radius?: number; fontSize?: number; fontWeight?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between";
  columns?: number; width?: string; height?: string; opacity?: number;
  shadow?: "none" | "soft" | "strong";
}

export interface CustomUiNode {
  type: CustomUiNodeType; id?: string; text?: string; title?: string;
  sourceId?: string; path?: string; format?: "text" | "number" | "date" | "temperature"; suffix?: string;
  url?: string; fit?: "cover" | "contain"; actionId?: string; icon?: string;
  style?: CustomUiStyle; children?: CustomUiNode[];
}

export interface CustomUiTheme {
  background?: string;
  foreground?: string;
  surface?: string;
  surfaceMuted?: string;
  accent?: string;
  radius?: number;
  padding?: number;
  gap?: number;
  shadow?: "none" | "soft" | "strong";
  fontFamily?: "system" | "rounded" | "mono";
}

export interface CustomUiDocument {
  version: 1; enabled: boolean;
  theme?: CustomUiTheme;
  pages?: Record<string, CustomUiNode>;
}

export function starterThemeOnly(): CustomUiDocument {
  return { version: 1, enabled: true, theme: {
    background: "#F4EFE6", foreground: "#24221F", surface: "#FFFCF7", surfaceMuted: "#EAE2D6", accent: "#B77952",
    radius: 26, padding: 12, gap: 10, shadow: "soft", fontFamily: "system",
  } };
}

export function starterCustomUi(pageId: string): CustomUiDocument {
  return { version: 1, enabled: true, theme: { background: "#070912", foreground: "#f8f9ff", accent: "#8b7cff", fontFamily: "system" }, pages: { [pageId]: {
    type: "column", style: { padding: 32, gap: 18, justify: "center" }, children: [
      { type: "text", text: "Dein Custom Dashboard", style: { fontSize: 48, fontWeight: 750 } },
      { type: "text", text: "Bearbeite das JSON oder lass es vom display UI Skill gestalten.", style: { fontSize: 20, opacity: 0.65 } },
      { type: "row", style: { gap: 16 }, children: [
        { type: "card", style: { padding: 24, radius: 24, background: "#15192b", width: "50%" }, children: [{ type: "text", text: "Live-Daten", style: { fontSize: 16, opacity: 0.6 } }, { type: "value", text: "Noch keine Quelle", style: { fontSize: 34, fontWeight: 700 } }] },
        { type: "card", style: { padding: 24, radius: 24, background: "#8b7cff", foreground: "#ffffff", width: "50%" }, children: [{ type: "text", text: "Bereit für KI", style: { fontSize: 16, opacity: 0.75 } }, { type: "text", text: "Mach etwas Großartiges ✦", style: { fontSize: 30, fontWeight: 700 } }] },
      ] },
    ],
  } } };
}

const nodeTypes = new Set<CustomUiNodeType>(["column", "row", "grid", "card", "text", "value", "image", "spacer", "button"]);
const containerTypes = new Set<CustomUiNodeType>(["column", "row", "grid", "card"]);

export function validateCustomUi(value: unknown, pageIds?: Set<string>): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["customUi muss ein Objekt sein."];
  const ui = value as Record<string, unknown>;
  if (ui.version !== 1) errors.push("customUi.version muss 1 sein.");
  if (typeof ui.enabled !== "boolean") errors.push("customUi.enabled muss true oder false sein.");
  if (ui.pages !== undefined && (typeof ui.pages !== "object" || ui.pages === null || Array.isArray(ui.pages))) return [...errors, "customUi.pages muss ein Objekt sein."];
  const pages = (ui.pages ?? {}) as Record<string, unknown>;
  if (ui.theme !== undefined && (!ui.theme || typeof ui.theme !== "object" || Array.isArray(ui.theme))) errors.push("customUi.theme muss ein Objekt sein.");
  if (pageIds) for (const id of Object.keys(pages)) if (!pageIds.has(id)) errors.push(`customUi.pages.${id} verweist auf keine Seite.`);
  let count = 0;
  const visit = (raw: unknown, path: string, depth: number) => {
    if (++count > 500) { if (!errors.includes("Custom UI darf höchstens 500 Elemente enthalten.")) errors.push("Custom UI darf höchstens 500 Elemente enthalten."); return; }
    if (depth > 20) { errors.push(`${path} ist tiefer als 20 Ebenen.`); return; }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push(`${path} muss ein Element sein.`); return; }
    const node = raw as Record<string, unknown>;
    if (!nodeTypes.has(node.type as CustomUiNodeType)) { errors.push(`${path}.type wird nicht unterstützt.`); return; }
    if (node.url !== undefined && (typeof node.url !== "string" || !/^(https:\/\/|\/api\/player\/|\/assets\/)/.test(node.url))) errors.push(`${path}.url muss HTTPS oder eine sichere Player-/Asset-URL verwenden.`);
    if (node.children !== undefined && !Array.isArray(node.children)) errors.push(`${path}.children muss ein Array sein.`);
    if (Array.isArray(node.children)) {
      if (!containerTypes.has(node.type as CustomUiNodeType)) errors.push(`${path} darf keine children enthalten.`);
      node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, depth + 1));
    }
  };
  Object.entries(pages).forEach(([id, root]) => visit(root, `customUi.pages.${id}`, 0));
  return errors.slice(0, 30);
}
