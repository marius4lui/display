export type WidgetType = "text" | "clock" | "image" | "value" | "weather" | "metric" | "status" | "list" | "chart" | "gauge";
export type ErrorBehavior = "stale" | "empty" | "error";
export type RuleOperator = ">" | ">=" | "<" | "<=" | "=" | "!=" | "contains" | "exists";
export interface ConditionalRule {
  operator: RuleOperator; value?: string; background?: string; foreground?: string; accent?: string; text?: string; icon?: string;
}

export interface DataSource {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
  query?: Record<string, string>;
  variables?: Record<string, string>;
  body?: string;
  auth: { type: "none" | "apiKey" | "bearer" | "basic"; name?: string; value?: string; username?: string; password?: string };
  refreshSeconds?: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  staticValue?: string;
  imageUrl?: string;
  dataSourceId?: string;
  jsonPath?: string;
  format?: "text" | "number" | "date" | "temperature";
  suffix?: string;
  min?: number;
  max?: number;
  listTitlePath?: string;
  listSubtitlePath?: string;
  maxItems?: number;
  chartType?: "line" | "bar" | "sparkline";
  historyDays?: number;
  statusMap?: Record<string, { text: string; icon?: string; color?: string }>;
  conditionalRules?: ConditionalRule[];
  animation?: "none" | "pulse" | "float" | "glow";
  errorBehavior: ErrorBehavior;
  style: {
    background: string;
    foreground: string;
    accent: string;
    align: "left" | "center" | "right";
    verticalAlign?: "top" | "center" | "bottom";
    fontScale?: number;
  };
}

export interface DashboardPage {
  id: string;
  name: string;
  widgets: Widget[];
}

export interface PageNavigation {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  style: Widget["style"];
}

export interface DashboardDocument {
  schemaVersion: 3;
  name: string;
  settings: {
    configPollSeconds: number;
    dataPollSeconds: number;
    columns: number;
    rows: number;
    background: string;
    foreground: string;
  };
  dataSources: DataSource[];
  pages: DashboardPage[];
  pageNavigation: PageNavigation;
}

export interface LegacyDashboardDocument extends Omit<DashboardDocument, "schemaVersion" | "pages" | "pageNavigation"> {
  schemaVersion: 1 | 2;
  widgets: Widget[];
}

const widget = (type: WidgetType, title: string, x: number, y: number, width: number, height: number): Widget => ({
  id: crypto.randomUUID(), type, title, x, y, width, height, errorBehavior: "stale", animation: "none",
  style: { background: "#151b2b", foreground: "#f6f7fb", accent: "#7c5cff", align: "left", verticalAlign: "center", fontScale: 100 },
});

export const blankDashboard = (): DashboardDocument => ({
  schemaVersion: 3,
  name: "Mein Dashboard",
  settings: { configPollSeconds: 30, dataPollSeconds: 300, columns: 12, rows: 8, background: "#090b12", foreground: "#f6f7fb" },
  dataSources: [],
  pages: [{ id: crypto.randomUUID(), name: "Seite 1", widgets: [
      { ...widget("text", "Willkommen", 0, 0, 7, 3), staticValue: "Alles auf einen Blick." },
      { ...widget("clock", "Uhrzeit", 7, 0, 5, 3), style: { background: "#7c5cff", foreground: "#ffffff", accent: "#b8a9ff", align: "center" } },
  ] }],
  pageNavigation: { visible: true, x: 4, y: 7, width: 4, height: 1, style: { background: "#151b2b", foreground: "#f6f7fb", accent: "#7c5cff", align: "center" } },
});

export const weatherTemplate = (): DashboardDocument => ({
  ...blankDashboard(),
  name: "Wetterstation",
  dataSources: [{ id: crypto.randomUUID(), name: "Wetter-API", method: "GET", url: "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,weather_code", headers: {}, auth: { type: "none" }, refreshSeconds: 600 }],
  pages: [{ id: crypto.randomUUID(), name: "Seite 1", widgets: [] }],
});

export function addDefaultWeatherWidgets(document: DashboardDocument): DashboardDocument {
  const sourceId = document.dataSources[0]?.id;
  return {
    ...document,
    pages: [{ ...document.pages[0], widgets: [
      { ...widget("weather", "Berlin", 0, 0, 8, 5), dataSourceId: sourceId, jsonPath: "current.temperature_2m", format: "temperature", suffix: "°C", animation: "float" },
      { ...widget("clock", "Lokale Zeit", 8, 0, 4, 5), style: { background: "#e5ff5f", foreground: "#11130a", accent: "#11130a", align: "center" } },
      { ...widget("text", "Hinweis", 0, 5, 12, 3), staticValue: "Daten werden automatisch aktualisiert." },
    ] }],
  };
}

export function normalizeDashboard(input: DashboardDocument | LegacyDashboardDocument): DashboardDocument {
  if (input.schemaVersion === 3) return input;
  if (input.schemaVersion === 2) return { ...(input as unknown as DashboardDocument), schemaVersion: 3 };
  const { widgets, ...rest } = input;
  return {
    ...rest,
    schemaVersion: 3,
    pages: [{ id: crypto.randomUUID(), name: "Seite 1", widgets }],
    pageNavigation: { visible: true, x: 4, y: 7, width: 4, height: 1, style: { background: "#151b2b", foreground: "#f6f7fb", accent: "#7c5cff", align: "center" } },
  };
}

export function overlaps(a: PlacementLike, b: PlacementLike): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

type PlacementLike = Pick<Widget, "x" | "y" | "width" | "height">;

export function placementIsFree(document: DashboardDocument, page: DashboardPage, placement: PlacementLike, ignoreWidgetId?: string): boolean {
  if (placement.x < 0 || placement.y < 0 || placement.width < 1 || placement.height < 1 || placement.x + placement.width > document.settings.columns || placement.y + placement.height > document.settings.rows) return false;
  if (document.pages.length > 1 && document.pageNavigation.visible && overlaps(placement, document.pageNavigation)) return false;
  return !page.widgets.some((item) => item.id !== ignoreWidgetId && overlaps(placement, item));
}

export function createWidget(type: WidgetType, index: number): Widget {
  const defaults: Record<WidgetType, Partial<Widget>> = {
    text: { title: "Text", staticValue: "Neuer Text" }, clock: { title: "Uhrzeit" }, image: { title: "Bild", imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200" }, value: { title: "API-Wert", jsonPath: "data.value", format: "text" }, weather: { title: "Wetter", jsonPath: "current.temperature_2m", format: "temperature", suffix: "°C" },
    metric: { title: "Metrik", jsonPath: "value", format: "number" }, status: { title: "Status", jsonPath: "status", statusMap: { online: { text: "Online", icon: "●", color: "#62de9a" }, offline: { text: "Offline", icon: "●", color: "#ff8296" } } },
    list: { title: "Liste", jsonPath: "items", listTitlePath: "name", listSubtitlePath: "value", maxItems: 5 },
    chart: { title: "Verlauf", jsonPath: "value", chartType: "line", historyDays: 1 },
    gauge: { title: "Auslastung", jsonPath: "value", format: "number", suffix: "%", min: 0, max: 100 },
  };
  return { ...widget(type, defaults[type].title ?? type, (index * 3) % 9, Math.floor(index / 3) * 2, type === "text" ? 6 : 4, 2), ...defaults[type] };
}

export function matchesRule(value: unknown, rule: ConditionalRule): boolean {
  const a = Number(value), b = Number(rule.value);
  if (rule.operator === "exists") return value !== undefined && value !== null;
  if (rule.operator === "contains") return String(value).includes(rule.value ?? "");
  if (rule.operator === "=") return String(value) === (rule.value ?? "");
  if (rule.operator === "!=") return String(value) !== (rule.value ?? "");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return rule.operator === ">" ? a > b : rule.operator === ">=" ? a >= b : rule.operator === "<" ? a < b : a <= b;
}

export function effectiveWidget(widget: Widget, value: unknown): Widget {
  const rule = widget.conditionalRules?.find((item) => matchesRule(value, item));
  if (!rule) return widget;
  return { ...widget, staticValue: rule.text ?? widget.staticValue, style: { ...widget.style, background: rule.background ?? widget.style.background, foreground: rule.foreground ?? widget.style.foreground, accent: rule.accent ?? widget.style.accent } };
}

function source(name: string, url: string): DataSource {
  return { id: crypto.randomUUID(), name, method: "GET", url, headers: {}, query: {}, variables: {}, auth: { type: "none" }, refreshSeconds: 60 };
}
function template(name: string, widgets: Array<Partial<Widget>>, dataSources: DataSource[] = []): DashboardDocument {
  const base = blankDashboard(); base.name = name; base.dataSources = dataSources;
  base.pages[0].widgets = widgets.map((item, index) => ({ ...createWidget(item.type ?? "metric", index), ...item, id: crypto.randomUUID() }));
  return base;
}
export const systemTemplates = [
  { name: "Smart Home", category: "Automation", description: "Raumklima, Energie und Gerätezustände.", create: () => { const api=source("Smart-Home-API","https://example.invalid/api/home"); return template("Smart Home", [{type:"metric",title:"Temperatur",dataSourceId:api.id,jsonPath:"temperature",suffix:"°C",x:0,y:0,width:4,height:3},{type:"gauge",title:"Energie",dataSourceId:api.id,jsonPath:"power",suffix:" W",max:5000,x:4,y:0,width:4,height:3},{type:"status",title:"Alarmanlage",dataSourceId:api.id,jsonPath:"alarm",x:8,y:0,width:4,height:3}], [api]); } },
  { name: "Service-Monitoring", category: "Monitoring", description: "Dienstzustände und Antwortzeiten.", create: () => { const api=source("Status-API","https://example.invalid/api/status"); return template("Service Monitoring", [{type:"status",title:"Gesamtstatus",dataSourceId:api.id,jsonPath:"status",x:0,y:0,width:4,height:3},{type:"list",title:"Dienste",dataSourceId:api.id,jsonPath:"services",listTitlePath:"name",listSubtitlePath:"status",x:4,y:0,width:8,height:5}], [api]); } },
  { name: "Server-Metriken", category: "Monitoring", description: "CPU, Speicher und historischer Verlauf.", create: () => { const api=source("Metrics-API","https://example.invalid/api/metrics"); return template("Server Metriken", [{type:"gauge",title:"CPU",dataSourceId:api.id,jsonPath:"cpu",suffix:"%",x:0,y:0,width:4,height:3},{type:"gauge",title:"RAM",dataSourceId:api.id,jsonPath:"memory",suffix:"%",x:4,y:0,width:4,height:3},{type:"chart",title:"CPU-Verlauf",dataSourceId:api.id,jsonPath:"cpu",x:0,y:3,width:8,height:4}], [api]); } },
  { name: "Wetter", category: "Wetter", description: "Aktuelles Wetter mit Open-Meteo.", create: () => addDefaultWeatherWidgets(weatherTemplate()) },
  { name: "Infoboard", category: "Information", description: "Uhrzeit, Hinweis und Meldungsliste.", create: () => template("Infoboard", [{type:"clock",title:"Uhrzeit",x:0,y:0,width:4,height:3},{type:"text",title:"Willkommen",staticValue:"Aktuelle Informationen",x:4,y:0,width:8,height:3},{type:"list",title:"Meldungen",staticValue:"Noch keine Datenquelle eingerichtet",x:0,y:3,width:12,height:4}]) },
] as const;

export function valueAtPath(input: unknown, path = ""): unknown {
  if (!path) return input;
  return path.replace(/^\$\.?/, "").split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object") return (value as Record<string, unknown>)[key];
    return undefined;
  }, input);
}

export function formatValue(value: unknown, format: Widget["format"], suffix = ""): string {
  if (value === undefined || value === null) return "—";
  if (format === "number" || format === "temperature") {
    const number = Number(value);
    return `${Number.isFinite(number) ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(number) : value}${suffix}`;
  }
  if (format === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  return `${String(value)}${suffix}`;
}
