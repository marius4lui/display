import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody, randomToken, sha256 } from "../../../../lib/server/http";
import { adminClient } from "../../../../lib/server/supabase";
import { clientFingerprint, requireDisplayHost, setPlayerCookie } from "../../../../lib/server/player";

function browserName(userAgent: string) {
  const browser = userAgent.includes("Edg/") ? "Edge" : userAgent.includes("Firefox/") ? "Firefox" : userAgent.includes("Chrome/") ? "Chrome" : userAgent.includes("Safari/") ? "Safari" : "Browser";
  const system = userAgent.includes("Windows") ? "Windows" : userAgent.includes("Android") ? "Android" : userAgent.includes("iPad") ? "iPad" : userAgent.includes("Mac") ? "macOS" : userAgent.includes("Linux") ? "Linux" : "";
  return `${browser}${system ? ` auf ${system}` : ""}`;
}

export async function POST(request: NextRequest) {
  const wrongHost = requireDisplayHost(request); if (wrongHost) return wrongHost;
  const body = await jsonBody(request);
  const code = String(body?.code ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) return apiError("INVALID_PAIRING", "Bitte einen sechsstelligen Code eingeben.");

  const database = adminClient();
  const fingerprint = clientFingerprint(request);
  const now = new Date();
  const { data: attempt } = await database.from("player_pairing_attempts").select("*").eq("fingerprint_hash", fingerprint).maybeSingle();
  if (attempt?.blocked_until && new Date(attempt.blocked_until) > now) {
    return apiError("RATE_LIMITED", "Zu viele Versuche. Bitte später erneut versuchen.", 429);
  }

  const token = randomToken();
  const { data, error } = await database.rpc("consume_web_pairing_code", {
    lookup_hash: sha256(code),
    device_name: browserName(request.headers.get("user-agent") ?? ""),
    new_token_hash: sha256(token),
  });
  const paired = Array.isArray(data) ? data[0] : data;
  if (error || !paired?.device_id) {
    const windowExpired = !attempt || now.valueOf() - new Date(attempt.window_started_at).valueOf() >= 10 * 60_000;
    const failed = windowExpired ? 1 : Number(attempt.failed_attempts) + 1;
    await database.from("player_pairing_attempts").upsert({
      fingerprint_hash: fingerprint,
      window_started_at: windowExpired ? now.toISOString() : attempt.window_started_at,
      failed_attempts: failed,
      blocked_until: failed >= 10 ? new Date(now.valueOf() + 10 * 60_000).toISOString() : null,
    });
    return apiError("INVALID_PAIRING", "Der Code ist ungültig, abgelaufen oder wurde bereits verwendet.", 401);
  }
  await database.from("player_pairing_attempts").delete().eq("fingerprint_hash", fingerprint);
  return setPlayerCookie(NextResponse.json({ paired: true }, { status: 201 }), token);
}
