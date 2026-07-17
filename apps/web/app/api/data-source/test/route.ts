import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody } from "../../../../lib/server/http";
import { userContext } from "../../../../lib/server/supabase";
import type { ApiDiagnostic, DiagnosticMessage } from "../../../../lib/api-diagnostics";
import type { DataSource } from "../../../../lib/dashboard";
import { executeDataSource } from "../../../../lib/server/data-source";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 1024 * 1024;
const TIMEOUT_MS = 20_000;

function classify(error: unknown): DiagnosticMessage {
  const item = error as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = item.cause?.code ?? item.name ?? "REQUEST_FAILED";
  const details = item.cause?.message ?? item.message ?? "Unbekannter Netzwerkfehler";
  if (item.name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT") return { code: "TIMEOUT", title: "Zeitüberschreitung", detail: details, hint: `Die API hat nicht innerhalb von ${TIMEOUT_MS / 1000} Sekunden geantwortet. Host, Port, Firewall und Serverlast prüfen.` };
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { code, title: "DNS-Auflösung fehlgeschlagen", detail: details, hint: "Der Hostname konnte nicht aufgelöst werden. Domain und DNS-Eintrag prüfen." };
  if (code === "ECONNREFUSED") return { code, title: "Verbindung abgelehnt", detail: details, hint: "Am Zielport nimmt kein Dienst Verbindungen an. Port, Protokoll und laufenden API-Dienst prüfen." };
  if (code === "ECONNRESET") return { code, title: "Verbindung zurückgesetzt", detail: details, hint: "Das Ziel oder ein Proxy hat die Verbindung vorzeitig beendet." };
  if (["CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(code)) return { code, title: "TLS-Zertifikat ungültig", detail: details, hint: "Zertifikatslaufzeit, Zertifikatskette und Hostname prüfen." };
  return { code, title: "Netzwerkanfrage fehlgeschlagen", detail: details, hint: "URL, Netzwerkzugriff, Proxy und TLS-Konfiguration prüfen." };
}

function completeHeaders(source: DataSource) {
  const headers = { ...(source.headers ?? {}) };
  if (source.auth?.type === "bearer" && source.auth.value) headers.Authorization = `Bearer ${source.auth.value}`;
  if (source.auth?.type === "apiKey" && source.auth.name && source.auth.value) headers[source.auth.name] = source.auth.value;
  if (source.auth?.type === "basic") headers.Authorization = `Basic ${Buffer.from(`${source.auth.username ?? ""}:${source.auth.password ?? ""}`).toString("base64")}`;
  return headers;
}

export async function POST(request: NextRequest) {
  const context = await userContext(request); if (!context) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const body = await jsonBody(request);
  const source = body?.source as DataSource | undefined;
  if (!source || !source.url || !source.method) return apiError("INVALID_SOURCE", "Datenquelle ist unvollständig");
  const startedAt = new Date().toISOString();
  let resolved;
  try { resolved = await executeDataSource(source, context.user.id, context.database); }
  catch (error) {
    const startedAt = new Date().toISOString();
    return NextResponse.json({ diagnostic: { ok: false, startedAt, durationMs: 0, request: { method: source.method, url: source.url, headers: completeHeaders(source), body: source.body ?? null }, error: classify(error) } satisfies ApiDiagnostic });
  }
  const diagnostic: ApiDiagnostic = {
    ok: true, startedAt, durationMs: resolved.durationMs,
    request: { method: source.method, url: resolved.url, headers: resolved.headers, body: resolved.body ?? null },
    response: { status: resolved.status, statusText: resolved.statusText, url: resolved.url, redirected: false, headers: resolved.responseHeaders, body: resolved.responseText, bodyTruncated: false, contentType: resolved.contentType, sizeBytes: new TextEncoder().encode(resolved.responseText).byteLength },
  };
  return NextResponse.json({ diagnostic });
}
