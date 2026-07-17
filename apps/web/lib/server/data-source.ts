import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataSource } from "../dashboard";
import { resolveTemplate } from "./secrets";

export const SOURCE_MAX_BYTES = 1024 * 1024;

export async function resolveDataSourceForClient(source: DataSource, ownerId: string, database: SupabaseClient): Promise<DataSource> {
  const variables = source.variables ?? {};
  const url = new URL(await resolveTemplate(source.url, ownerId, variables, database));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Nur HTTP- und HTTPS-URLs sind erlaubt");
  for (const [name, value] of Object.entries(source.query ?? {})) {
    if (value) url.searchParams.set(name, await resolveTemplate(value, ownerId, variables, database));
  }
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(source.headers ?? {})) {
    headers[name] = await resolveTemplate(value, ownerId, variables, database);
  }
  const auth = { ...source.auth };
  if (auth.value) auth.value = await resolveTemplate(auth.value, ownerId, variables, database);
  if (auth.username) auth.username = await resolveTemplate(auth.username, ownerId, variables, database);
  if (auth.password) auth.password = await resolveTemplate(auth.password, ownerId, variables, database);
  const body = source.method === "GET" || source.body === undefined
    ? source.body
    : await resolveTemplate(source.body, ownerId, variables, database);
  return { ...source, url: url.toString(), headers, query: {}, variables: {}, auth, body };
}

export async function executeDataSource(source: DataSource, ownerId: string, database: SupabaseClient) {
  const variables = source.variables ?? {};
  const url = new URL(await resolveTemplate(source.url, ownerId, variables, database));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Nur HTTP- und HTTPS-URLs sind erlaubt");
  for (const [name, value] of Object.entries(source.query ?? {})) if (value) url.searchParams.set(name, await resolveTemplate(value, ownerId, variables, database));
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(source.headers ?? {})) headers[name] = await resolveTemplate(value, ownerId, variables, database);
  if (source.auth.type === "bearer" && source.auth.value) headers.Authorization = `Bearer ${await resolveTemplate(source.auth.value, ownerId, variables, database)}`;
  if (source.auth.type === "apiKey" && source.auth.name && source.auth.value) headers[source.auth.name] = await resolveTemplate(source.auth.value, ownerId, variables, database);
  if (source.auth.type === "basic") headers.Authorization = `Basic ${Buffer.from(`${await resolveTemplate(source.auth.username ?? "", ownerId, variables, database)}:${await resolveTemplate(source.auth.password ?? "", ownerId, variables, database)}`).toString("base64")}`;
  const body = source.method === "GET" ? undefined : await resolveTemplate(source.body ?? "", ownerId, variables, database);
  const started = performance.now();
  const response = await fetch(url, { method: source.method, headers, body, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > SOURCE_MAX_BYTES) throw new Error("Antwort überschreitet 1 MB");
  const text = new TextDecoder().decode(bytes);
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} ${response.statusText}`), { status: response.status });
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Antwort ist kein gültiges JSON"); }
  return { value, responseText: text, responseHeaders: Object.fromEntries(response.headers.entries()), contentType: response.headers.get("content-type") ?? "", status: response.status, statusText: response.statusText, durationMs: Math.round(performance.now() - started), url: url.toString(), headers, body };
}
