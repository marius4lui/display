import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody, sha256 } from "../../../../lib/server/http";
import { adminClient } from "../../../../lib/server/supabase";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get("authorization"); if (!authorization?.startsWith("Bearer ")) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe erforderlich", 401);
  const database = adminClient(); const publicId = (await params).id;
  const { data: display } = await database.from("displays").select("id").eq("public_id", publicId).maybeSingle();
  if (!display) return apiError("NOT_FOUND", "Dashboard nicht gefunden", 404);
  const body = await jsonBody(request);
  const { error } = await database.from("display_devices").update({
    last_seen_at: new Date().toISOString(), app_version: String(body?.appVersion ?? "").slice(0, 40),
    platform_version: String(body?.platformVersion ?? "").slice(0, 40), dashboard_version: Number(body?.dashboardVersion ?? 0),
    last_sync_at: body?.lastSyncAt ?? null, last_data_at: body?.lastDataAt ?? null,
    last_error: body?.lastError ? String(body.lastError).slice(0, 500) : null,
  }).eq("display_id", display.id).eq("token_hash", sha256(authorization.slice(7))).is("revoked_at", null);
  return error ? apiError("HEARTBEAT_FAILED", "Heartbeat konnte nicht gespeichert werden", 500) : new NextResponse(null, { status: 204 });
}
