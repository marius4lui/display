import { NextRequest, NextResponse } from "next/server";
import type { DashboardDocument } from "../../../../../lib/dashboard";
import { apiError } from "../../../../../lib/server/http";
import { executeHomeAssistantSource, fetchImmichThumbnail, immichAssetBelongsToAlbum, ownedIntegration } from "../../../../../lib/server/integrations";
import { playerDevice, requireDisplayHost } from "../../../../../lib/server/player";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const wrongHost = requireDisplayHost(request); if (wrongHost) return wrongHost;
  const found = await playerDevice(request); if (!found) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const { database, device } = found;
  const { sourceId } = await params;
  const { data: display } = await database.from("displays").select("id,owner_id,active_version").eq("id", device.display_id).maybeSingle();
  if (!display?.active_version) return apiError("NOT_PUBLISHED", "Kein veröffentlichtes Dashboard", 404);
  const { data: version } = await database.from("display_versions").select("document").eq("display_id", display.id).eq("version", display.active_version).maybeSingle();
  const source = (version?.document as DashboardDocument | undefined)?.dataSources.find((item) => item.id === sourceId);
  if (!source || (source.type !== "immich" && !(source.type === "home_assistant" && source.resource === "camera"))) return apiError("IMAGE_NOT_FOUND", "Bildquelle nicht gefunden", 404);
  const integration = await ownedIntegration(database, display.owner_id, source.integrationId);
  if (!integration || integration.provider !== source.type || integration.status !== "active") return apiError("INTEGRATION_UNAVAILABLE", "Integration ist nicht aktiv", 409);
  try {
    if (source.type === "home_assistant") {
      const result = await executeHomeAssistantSource(integration, source);
      if (!("image" in result) || !result.image) return apiError("IMAGE_FAILED", "Kamerabild fehlt", 502);
      return new NextResponse(Buffer.from(result.image), { headers: { "Content-Type": result.contentType ?? "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const assetId = request.nextUrl.searchParams.get("assetId") ?? "";
    if (!await immichAssetBelongsToAlbum(integration, source.albumId, assetId)) return apiError("ASSET_NOT_FOUND", "Foto gehört nicht zum ausgewählten Album", 404);
    const image = await fetchImmichThumbnail(integration, assetId);
    return new NextResponse(Buffer.from(image.bytes), { headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError("IMAGE_FETCH_FAILED", error instanceof Error ? error.message : "Bild konnte nicht geladen werden", 502); }
}
