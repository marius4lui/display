import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody } from "../../../../lib/server/http";
import { userContext } from "../../../../lib/server/supabase";
import type { ApiDiagnostic, DiagnosticMessage } from "../../../../lib/api-diagnostics";
import type { DataSource } from "../../../../lib/dashboard";

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
  if (!await userContext(request)) return apiError("UNAUTHENTICATED", "Anmeldung erforderlich", 401);
  const body = await jsonBody(request);
  const source = body?.source as DataSource | undefined;
  if (!source || !source.url || !source.method) return apiError("INVALID_SOURCE", "Datenquelle ist unvollständig");
  let url: URL;
  try { url = new URL(source.url); } catch { return apiError("INVALID_URL", "Die API-URL ist ungültig"); }
  if (!(["http:", "https:"].includes(url.protocol))) return apiError("INVALID_PROTOCOL", "Nur HTTP- und HTTPS-URLs sind erlaubt");

  const headers = completeHeaders(source);
  const requestBody = source.method === "GET" ? null : source.body ?? "";
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const requestInfo = { method: source.method, url: url.toString(), headers, body: requestBody };
  try {
    const response = await fetch(url, { method: source.method, headers, body: requestBody ?? undefined, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const shown = bytes.slice(0, MAX_BODY_BYTES);
    const text = new TextDecoder().decode(shown);
    const diagnostic: ApiDiagnostic = {
      ok: response.ok,
      startedAt,
      durationMs: Math.round(performance.now() - started),
      request: requestInfo,
      response: {
        status: response.status, statusText: response.statusText, url: response.url,
        redirected: response.redirected, headers: Object.fromEntries(response.headers.entries()),
        body: text, bodyTruncated: bytes.length > MAX_BODY_BYTES,
        contentType: response.headers.get("content-type") ?? "", sizeBytes: bytes.length,
      },
      ...(!response.ok ? { error: { code: `HTTP_${response.status}`, title: `HTTP ${response.status} ${response.statusText}`, detail: "Die API wurde erreicht, hat die Anfrage aber abgelehnt oder konnte sie nicht verarbeiten.", hint: response.status === 401 || response.status === 403 ? "Authentifizierung, Token-Berechtigungen und Header prüfen." : response.status === 404 ? "Pfad, API-Version und Ressource prüfen." : response.status === 429 ? "Rate-Limit erreicht. Intervall erhöhen oder Limit beim Anbieter prüfen." : response.status >= 500 ? "Fehler auf dem Zielserver. Response-Body und Server-Logs prüfen." : "Request-Parameter, Header und Body mit der API-Dokumentation abgleichen." } } : {}),
    };
    return NextResponse.json({ diagnostic });
  } catch (error) {
    const diagnostic: ApiDiagnostic = { ok: false, startedAt, durationMs: Math.round(performance.now() - started), request: requestInfo, error: classify(error) };
    return NextResponse.json({ diagnostic });
  }
}
