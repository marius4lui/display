export type WidgetType = "text" | "clock" | "image" | "value" | "weather";
export type ErrorBehavior = "stale" | "empty" | "error";

export interface DataSource {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
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
  animation?: "none" | "pulse" | "float" | "glow";
  errorBehavior: ErrorBehavior;
  style: { background: string; foreground: string; accent: string; align: "left" | "center" | "right" };
}

export interface DashboardDocument {
  schemaVersion: 1;
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
  widgets: Widget[];
}

const widget = (type: WidgetType, title: string, x: number, y: number, width: number, height: number): Widget => ({
  id: crypto.randomUUID(), type, title, x, y, width, height, errorBehavior: "stale", animation: "none",
  style: { background: "#151b2b", foreground: "#f6f7fb", accent: "#7c5cff", align: "left" },
});

export const blankDashboard = (): DashboardDocument => ({
  schemaVersion: 1,
  name: "Mein Dashboard",
  settings: { configPollSeconds: 30, dataPollSeconds: 300, columns: 12, rows: 8, background: "#090b12", foreground: "#f6f7fb" },
  dataSources: [],
  widgets: [
    { ...widget("text", "Willkommen", 0, 0, 7, 3), staticValue: "Alles auf einen Blick." },
    { ...widget("clock", "Uhrzeit", 7, 0, 5, 3), style: { background: "#7c5cff", foreground: "#ffffff", accent: "#b8a9ff", align: "center" } },
  ],
});

export const weatherTemplate = (): DashboardDocument => ({
  ...blankDashboard(),
  name: "Wetterstation",
  dataSources: [{ id: crypto.randomUUID(), name: "Wetter-API", method: "GET", url: "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,weather_code", headers: {}, auth: { type: "none" }, refreshSeconds: 600 }],
  widgets: [],
});

export function addDefaultWeatherWidgets(document: DashboardDocument): DashboardDocument {
  const sourceId = document.dataSources[0]?.id;
  return {
    ...document,
    widgets: [
      { ...widget("weather", "Berlin", 0, 0, 8, 5), dataSourceId: sourceId, jsonPath: "current.temperature_2m", format: "temperature", suffix: "°C", animation: "float" },
      { ...widget("clock", "Lokale Zeit", 8, 0, 4, 5), style: { background: "#e5ff5f", foreground: "#11130a", accent: "#11130a", align: "center" } },
      { ...widget("text", "Hinweis", 0, 5, 12, 3), staticValue: "Daten werden automatisch aktualisiert." },
    ],
  };
}

export function createWidget(type: WidgetType, index: number): Widget {
  const defaults: Record<WidgetType, Partial<Widget>> = {
    text: { title: "Text", staticValue: "Neuer Text" }, clock: { title: "Uhrzeit" }, image: { title: "Bild", imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200" }, value: { title: "API-Wert", jsonPath: "data.value", format: "text" }, weather: { title: "Wetter", jsonPath: "current.temperature_2m", format: "temperature", suffix: "°C" },
  };
  return { ...widget(type, defaults[type].title ?? type, (index * 3) % 9, Math.floor(index / 3) * 2, type === "text" ? 6 : 4, 2), ...defaults[type] };
}

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
