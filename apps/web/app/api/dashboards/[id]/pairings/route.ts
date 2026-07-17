import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../lib/server/display";
import { apiError, randomToken, sha256 } from "../../../../../lib/server/http";
import { publicUrl } from "../../../../../lib/server/public-url";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  if (!found.display.active_version) return apiError("NOT_PUBLISHED", "Dashboard zuerst veröffentlichen.", 409);
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0"); const qrToken = randomToken(); const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await found.context.database.from("device_pairing_codes").delete().eq("display_id", found.display.id).is("consumed_at", null);
  const { error } = await found.context.database.from("device_pairing_codes").insert([
    { display_id: found.display.id, code_hash: sha256(`${found.display.public_id}:${code}`), expires_at: expiresAt },
    { display_id: found.display.id, code_hash: sha256(`${found.display.public_id}:${qrToken}`), expires_at: expiresAt },
  ]);
  return error ? apiError("PAIRING_FAILED", "Pairing-Code konnte nicht erzeugt werden", 500) : NextResponse.json({ code, qrToken, expiresAt, displayUrl: publicUrl(request, `/d/${found.display.public_id}`) }, { status: 201 });
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const { data, error } = await found.context.database.from("display_devices").select("id, name, paired_at, last_seen_at, revoked_at, app_version, platform_version, dashboard_version, last_sync_at, last_data_at, last_error").eq("display_id", found.display.id).order("paired_at", { ascending: false });
  const now = Date.now();
  return error ? apiError("DATABASE_ERROR", "Geräte konnten nicht geladen werden", 500) : NextResponse.json({ devices: (data ?? []).map((device) => ({ ...device, online: !!device.last_seen_at && now - new Date(device.last_seen_at).valueOf() < 120_000 })) });
}
