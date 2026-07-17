import { NextRequest, NextResponse } from "next/server";
import { apiError, jsonBody } from "../../../../lib/server/http";
import { playerDevice, requireDisplayHost } from "../../../../lib/server/player";

export async function POST(request: NextRequest) {
  const wrongHost = requireDisplayHost(request); if (wrongHost) return wrongHost;
  const found = await playerDevice(request);
  if (!found) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const body = await jsonBody(request);
  const { error } = await found.database.from("display_devices").update({
    last_seen_at: new Date().toISOString(),
    app_version: String(body?.appVersion ?? "web-1").slice(0, 40),
    platform_version: String(body?.platformVersion ?? "").slice(0, 80),
    dashboard_version: Number(body?.dashboardVersion ?? 0) || null,
    last_sync_at: body?.lastSyncAt ?? null,
    last_data_at: body?.lastDataAt ?? null,
    last_error: body?.lastError ? String(body.lastError).slice(0, 500) : null,
  }).eq("id", found.device.id);
  return error ? apiError("HEARTBEAT_FAILED", "Heartbeat konnte nicht gespeichert werden", 500) : new NextResponse(null, { status: 204 });
}
