import { isIP } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";

export const INTEGRATION_MAX_BYTES = 1024 * 1024;
export const dnsAnswersChanged = (before: Set<string>, after: Set<string>) => [...after].some((address) => !before.has(address));

function privateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map(Number);
  return parts.length === 4 && (
    parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    parts[0] === 169 && parts[1] === 254 ||
    parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 ||
    parts[0] === 192 && parts[1] === 168 ||
    parts[0] >= 224
  );
}

export async function assertPublicHttps(input: string, expectedOrigin?: string) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Nur öffentliche HTTPS-Adressen sind erlaubt");
  if (expectedOrigin && url.origin !== expectedOrigin) throw new Error("Weiterleitung auf einen fremden Host wurde blockiert");
  const addresses = isIP(url.hostname)
    ? [url.hostname]
    : [...await resolve4(url.hostname).catch(() => []), ...await resolve6(url.hostname).catch(() => [])];
  if (!addresses.length || addresses.some(privateAddress)) throw new Error("Private oder nicht auflösbare Zieladresse wurde blockiert");
  return { url, addresses: new Set(addresses) };
}

export async function safeFetch(input: string, init: RequestInit & { timeoutMs?: number; expectedOrigin?: string } = {}) {
  let current = input;
  const origin = init.expectedOrigin ?? new URL(input).origin;
  for (let redirect = 0; redirect <= 3; redirect++) {
    const before = await assertPublicHttps(current, origin);
    const response = await fetch(before.url, { ...init, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(init.timeoutMs ?? 20_000) });
    // Resolve again after the connection to detect a changed DNS answer.
    const after = await assertPublicHttps(current, origin);
    if (dnsAnswersChanged(before.addresses, after.addresses)) throw new Error("DNS-Auflösungswechsel wurde blockiert");
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Ungültige Weiterleitung");
      await response.body?.cancel();
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error("Zu viele Weiterleitungen");
}

export async function limitedResponse(response: Response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > INTEGRATION_MAX_BYTES) throw new Error("Antwort überschreitet 1 MB");
  const reader = response.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(), text: "" };
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > INTEGRATION_MAX_BYTES) { await reader.cancel(); throw new Error("Antwort überschreitet 1 MB"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return { bytes, text: new TextDecoder().decode(bytes) };
}
