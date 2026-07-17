import type { NextRequest } from "next/server";
import { apiError, sha256 } from "./http";
import { adminClient } from "./supabase";

export const PLAYER_COOKIE = process.env.NODE_ENV === "production" ? "__Host-display-player" : "display-player";

export function displayOrigin() {
  const value = process.env.PUBLIC_DISPLAY_URL?.trim();
  if (!value) throw new Error("PUBLIC_DISPLAY_URL ist nicht konfiguriert");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("PUBLIC_DISPLAY_URL muss eine absolute HTTP(S)-URL sein");
  }
  return url;
}

export function isDisplayRequest(request: NextRequest | Request) {
  const configured = displayOrigin();
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  return host.toLowerCase() === configured.host.toLowerCase();
}

export function requireDisplayHost(request: NextRequest) {
  return isDisplayRequest(request) ? null : apiError("NOT_FOUND", "Nicht gefunden", 404);
}

export function setPlayerCookie(response: Response & { cookies: { set: Function } }, token: string) {
  response.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export function clearPlayerCookie(response: Response & { cookies: { set: Function } }) {
  response.cookies.set(PLAYER_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function playerDevice(request: NextRequest) {
  const token = request.cookies.get(PLAYER_COOKIE)?.value;
  if (!token) return null;
  const database = adminClient();
  const { data: device } = await database
    .from("display_devices")
    .select("id, display_id, name, platform")
    .eq("token_hash", sha256(token))
    .eq("platform", "web")
    .is("revoked_at", null)
    .maybeSingle();
  return device ? { database, device } : null;
}

export function clientFingerprint(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  return sha256(`${address}|${request.headers.get("user-agent") ?? "unknown"}`);
}
