import { NextResponse } from "next/server";
import { apiError, jsonBody, randomToken, sha256 } from "../../../../lib/server/http";
import { publicUrl } from "../../../../lib/server/public-url";
import { adminClient } from "../../../../lib/server/supabase";

export async function POST(request: Request) {
  const body = await jsonBody(request); const displayId = String(body?.displayId ?? ""); const code = String(body?.code ?? ""); const name = String(body?.name ?? "Android Display").trim().slice(0, 100) || "Android Display";
  const validPairingSecret = /^\d{6}$/.test(code) || /^[A-Za-z0-9_-]{32,128}$/.test(code);
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(displayId) || !validPairingSecret) return apiError("INVALID_PAIRING", "Display-ID oder Pairing-Code ist ungültig");
  const admin = adminClient(); const { data: display } = await admin.from("displays").select("id, public_id").eq("public_id", displayId).maybeSingle();
  if (!display) return apiError("INVALID_PAIRING", "Pairing-Code ist ungültig", 401);
  const hash = sha256(`${displayId}:${code}`);
  const { data: pairing } = await admin.from("device_pairing_codes").select("id").eq("display_id", display.id).eq("code_hash", hash).is("consumed_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!pairing) return apiError("INVALID_PAIRING", "Pairing-Code ist ungültig oder abgelaufen", 401);
  const consumed = await admin.from("device_pairing_codes").update({ consumed_at: new Date().toISOString() }).eq("id", pairing.id).is("consumed_at", null).select("id").maybeSingle();
  if (!consumed.data) return apiError("INVALID_PAIRING", "Pairing-Code wurde bereits verwendet", 409);
  await admin.from("device_pairing_codes").update({ consumed_at: new Date().toISOString() }).eq("display_id", display.id).is("consumed_at", null);
  const token = randomToken(); const { data: device, error } = await admin.from("display_devices").insert({ display_id: display.id, name, token_hash: sha256(token) }).select("id").single();
  if (error || !device) return apiError("PAIRING_FAILED", "Gerät konnte nicht gekoppelt werden", 500);
  return NextResponse.json({ deviceId: device.id, deviceToken: token, displayUrl: publicUrl(request, `/d/${displayId}`) }, { status: 201 });
}
