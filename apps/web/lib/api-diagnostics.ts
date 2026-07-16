import type { DataSource } from "./dashboard";

export type DiagnosticMessage = { code: string; title: string; detail: string; hint: string };
export type HttpExchange = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
};
export type ApiDiagnostic = {
  ok: boolean;
  startedAt: string;
  durationMs: number;
  request: HttpExchange;
  response?: {
    status: number;
    statusText: string;
    url: string;
    redirected: boolean;
    headers: Record<string, string>;
    body: string;
    bodyTruncated: boolean;
    contentType: string;
    sizeBytes: number;
  };
  error?: DiagnosticMessage;
};

export function requestHeaders(source: DataSource): Record<string, string> {
  const headers = { ...source.headers };
  if (source.auth.type === "bearer" && source.auth.value) headers.Authorization = `Bearer ${source.auth.value}`;
  if (source.auth.type === "apiKey" && source.auth.name && source.auth.value) headers[source.auth.name] = source.auth.value;
  if (source.auth.type === "basic") headers.Authorization = `Basic ${btoa(`${source.auth.username ?? ""}:${source.auth.password ?? ""}`)}`;
  return headers;
}

export function parsedResponseBody(diagnostic: ApiDiagnostic): unknown {
  if (!diagnostic.response?.body || !diagnostic.response.contentType.includes("json")) return undefined;
  try { return JSON.parse(diagnostic.response.body); } catch { return undefined; }
}
