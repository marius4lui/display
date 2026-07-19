import { NextRequest, NextResponse } from "next/server";
import type { DashboardAction, DashboardDocument } from "../../../../../lib/dashboard";
import { apiError } from "../../../../../lib/server/http";
import { executeIntegrationAction, ownedIntegration } from "../../../../../lib/server/integrations";
import { playerDevice, requireDisplayHost } from "../../../../../lib/server/player";

export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ actionId: string }> }) {
  const wrongHost = requireDisplayHost(request); if (wrongHost) return wrongHost;
  const found = await playerDevice(request); if (!found) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const actionId = (await params).actionId; const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 160) return apiError("IDEMPOTENCY_KEY_REQUIRED", "Gültiger Idempotency-Key erforderlich", 400);
  const { database, device } = found;
  const { data: display } = await database.from("displays").select("id,owner_id,active_version").eq("id", device.display_id).maybeSingle();
  if (!display?.active_version) return apiError("NOT_PUBLISHED", "Kein veröffentlichtes Dashboard", 404);
  const requestedVersion = Number(request.headers.get("x-player-config-version"));
  if (requestedVersion !== display.active_version) return apiError("CONFIG_CHANGED", "Eine neue Dashboard-Version ist verfügbar", 409);
  const { data: version } = await database.from("display_versions").select("document").eq("display_id", display.id).eq("version", display.active_version).maybeSingle();
  const action = (version?.document as DashboardDocument | undefined)?.actions?.find((item: DashboardAction) => item.id === actionId);
  if (!action) return apiError("ACTION_NOT_FOUND", "Aktion gehört nicht zur aktiven Version", 404);
  const integration = await ownedIntegration(database, display.owner_id, action.integrationId);
  if (!integration || integration.status !== "active" || integration.provider !== action.provider) {
    await database.from("action_audit").insert({ owner_id: display.owner_id, integration_id: integration?.id, display_id: display.id, device_id: device.id, action_id: actionId, idempotency_key: idempotencyKey, status: "failed", error_code: "INTEGRATION_UNAVAILABLE" });
    return apiError("INTEGRATION_UNAVAILABLE", "Integration ist nicht aktiv", 409);
  }
  const reservation = { owner_id: display.owner_id, integration_id: integration.id, display_id: display.id, device_id: device.id, action_id: actionId, idempotency_key: idempotencyKey, status: "pending" };
  const { data: reserved, error: reserveError } = await database.from("action_audit").insert(reservation).select("id").maybeSingle();
  if (reserveError || !reserved) {
    const { data: duplicate } = await database.from("action_audit").select("status,http_status,duration_ms,error_code").eq("device_id", device.id).eq("action_id", actionId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (duplicate) return NextResponse.json({ ...duplicate, duplicate: true }, { status: duplicate.status === "pending" ? 202 : 200 });
    return apiError("ACTION_RESERVATION_FAILED", "Aktion konnte nicht reserviert werden", 503);
  }
  const { data: claim } = await database.rpc("claim_player_action", { target_device: device.id, target_action: actionId, cooldown_ms: action.cooldownMs ?? 2000, max_per_minute: 30 });
  if (claim !== "ok") {
    await database.from("action_audit").update({ status: "rate_limited", error_code: claim }).eq("id", reserved.id);
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }
  const started = performance.now(); let status: "success"|"failed"|"timeout" = "success"; let httpStatus: number | undefined; let result: unknown; let errorCode: string | undefined;
  try {
    const executed = await executeIntegrationAction(integration, action, { deviceId: device.id, dashboardVersion: display.active_version, timestamp: new Date().toISOString() });
    result = executed.value; httpStatus = executed.status;
  } catch (error) {
    status = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "failed";
    errorCode = status === "timeout" ? "TIMEOUT" : "PROVIDER_ERROR"; httpStatus = (error as { status?: number }).status;
  }
  const durationMs = Math.round(performance.now() - started);
  await database.from("action_audit").update({ status, http_status: httpStatus, duration_ms: durationMs, error_code: errorCode }).eq("id", reserved.id);
  const responseSource = action.responseSourceId ? (version?.document as DashboardDocument).dataSources.find((source) => source.type === "action_response" && source.id === action.responseSourceId && source.actionId === action.id) : undefined;
  return NextResponse.json({
    status,
    message: action.useResponseMessage && typeof result === "string" ? result.slice(0, 500) : undefined,
    responseSourceId: responseSource?.id,
    responseValue: responseSource ? result : undefined,
    refreshSourceIds: (version?.document as DashboardDocument).dataSources.filter((source) => source.type === "home_assistant" && source.integrationId === integration.id).map((source) => source.id),
  }, { status: status === "success" ? 200 : status === "timeout" ? 504 : 502 });
}
