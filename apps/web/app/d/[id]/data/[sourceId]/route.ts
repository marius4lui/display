import { NextRequest, NextResponse } from "next/server";
import type { DashboardDocument } from "../../../../../lib/dashboard";
import { apiError, sha256 } from "../../../../../lib/server/http";
import { executeHomeAssistantSource, executeImmichSource, executeN8nSource, ownedIntegration } from "../../../../../lib/server/integrations";
import { adminClient } from "../../../../../lib/server/supabase";

export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe erforderlich", 401);
  const { id, sourceId } = await params; const database = adminClient();
  const { data: display } = await database.from("displays").select("id,owner_id,active_version").eq("public_id", id).maybeSingle();
  if (!display?.active_version) return apiError("NOT_FOUND", "Kein veröffentlichtes Dashboard", 404);
  const { data: device } = await database.from("display_devices").select("id").eq("display_id", display.id).eq("token_hash", sha256(authorization.slice(7))).is("revoked_at", null).maybeSingle();
  if (!device) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const { data: version } = await database.from("display_versions").select("document").eq("display_id", display.id).eq("version", display.active_version).maybeSingle();
  const source = (version?.document as DashboardDocument | undefined)?.dataSources.find((item) => item.id === sourceId);
  if (!source || (source.type !== "home_assistant" && source.type !== "n8n" && source.type !== "immich")) return apiError("SOURCE_NOT_FOUND", "Verwaltete Datenquelle nicht gefunden", 404);
  const integration = await ownedIntegration(database, display.owner_id, source.integrationId);
  if (!integration || integration.status !== "active" || integration.provider !== source.type) return apiError("INTEGRATION_UNAVAILABLE", "Integration ist nicht aktiv", 409);
  try {
    const result = source.type === "home_assistant" ? await executeHomeAssistantSource(integration, source) : source.type === "n8n" ? await executeN8nSource(integration, source) : await executeImmichSource(integration, source);
    if ("image" in result) return apiError("BINARY_SOURCE_UNSUPPORTED", "Kamerabilder werden im nativen Datenabruf nicht unterstützt", 409);
    return NextResponse.json(result.value, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError("SOURCE_FETCH_FAILED", error instanceof Error ? error.message : "Datenquelle konnte nicht geladen werden", 502); }
}
