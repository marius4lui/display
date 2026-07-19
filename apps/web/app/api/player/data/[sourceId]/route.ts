import { NextRequest, NextResponse } from "next/server";
import type { DashboardDocument, DataSource } from "../../../../../lib/dashboard";
import { executeDataSource } from "../../../../../lib/server/data-source";
import { apiError } from "../../../../../lib/server/http";
import { playerDevice, requireDisplayHost } from "../../../../../lib/server/player";
import { executeHomeAssistantSource, executeN8nSource, ownedIntegration } from "../../../../../lib/server/integrations";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const wrongHost = requireDisplayHost(request); if (wrongHost) return wrongHost;
  const found = await playerDevice(request);
  if (!found) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);

  const { database, device } = found;
  const sourceId = (await params).sourceId;
  if (!sourceId || sourceId.length > 160) return apiError("SOURCE_NOT_FOUND", "Datenquelle nicht gefunden", 404);

  const { data: display } = await database.from("displays").select("id, owner_id, active_version").eq("id", device.display_id).maybeSingle();
  if (!display?.active_version) return apiError("NOT_PUBLISHED", "Kein veröffentlichtes Dashboard", 404);
  const requestedVersion = Number(request.headers.get("x-player-config-version"));
  if (Number.isFinite(requestedVersion) && requestedVersion > 0 && requestedVersion !== display.active_version) {
    return apiError("CONFIG_CHANGED", "Eine neue Dashboard-Version ist verfügbar", 409);
  }
  const { data: version } = await database.from("display_versions").select("document").eq("display_id", display.id).eq("version", display.active_version).maybeSingle();
  const document = version?.document as DashboardDocument | undefined;
  const source = document?.dataSources?.find((candidate: DataSource) => candidate.id === sourceId);
  if (!source) return apiError("SOURCE_NOT_FOUND", "Datenquelle nicht gefunden", 404);

  try {
    if (source.type === "action_response") return apiError("ACTION_REQUIRED", "Diese Datenquelle wird nur durch ihre Action aktualisiert", 409);
    if (source.type === "home_assistant") {
      const integration = await ownedIntegration(database, display.owner_id, source.integrationId);
      if (!integration || integration.provider !== "home_assistant" || integration.status !== "active") return apiError("INTEGRATION_UNAVAILABLE", "Home Assistant ist nicht aktiv", 409);
      const result = await executeHomeAssistantSource(integration, source);
      if ("image" in result && result.image) return new NextResponse(Buffer.from(result.image), { headers: { "Content-Type": result.contentType ?? "image/jpeg", "Cache-Control": "private, no-store" } });
      return NextResponse.json({ value: result.value, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (source.type === "n8n") {
      const integration = await ownedIntegration(database, display.owner_id, source.integrationId);
      if (!integration || integration.provider !== "n8n" || integration.status !== "active") return apiError("INTEGRATION_UNAVAILABLE", "n8n ist nicht aktiv", 409);
      const result = await executeN8nSource(integration, source);
      return NextResponse.json({ value: result.value, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const result = await executeDataSource(source, display.owner_id, database);
    return NextResponse.json({
      value: result.value,
      checkedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      httpStatus: result.status,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "Datenquelle konnte nicht geladen werden";
    return apiError("SOURCE_FETCH_FAILED", message, 502);
  }
}
