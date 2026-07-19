import { NextRequest, NextResponse } from "next/server";
import type { DashboardDocument } from "../../../../../lib/dashboard";
import { apiError, sha256 } from "../../../../../lib/server/http";
import { fetchImmichThumbnail, immichAssetBelongsToAlbum, ownedIntegration } from "../../../../../lib/server/integrations";
import { adminClient } from "../../../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const authorization = request.headers.get("authorization"); if (!authorization?.startsWith("Bearer ")) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe erforderlich", 401);
  const { id, sourceId } = await params; const database = adminClient();
  const { data: display } = await database.from("displays").select("id,owner_id,active_version").eq("public_id", id).maybeSingle();
  if (!display?.active_version) return apiError("NOT_FOUND", "Kein veröffentlichtes Dashboard", 404);
  const { data: device } = await database.from("display_devices").select("id").eq("display_id", display.id).eq("token_hash", sha256(authorization.slice(7))).is("revoked_at", null).maybeSingle();
  if (!device) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const { data: version } = await database.from("display_versions").select("document").eq("display_id", display.id).eq("version", display.active_version).maybeSingle();
  const source = (version?.document as DashboardDocument | undefined)?.dataSources.find((item) => item.id === sourceId);
  if (!source || source.type !== "immich") return apiError("SOURCE_NOT_FOUND", "Immich-Album nicht gefunden", 404);
  const integration = await ownedIntegration(database, display.owner_id, source.integrationId);
  if (!integration || integration.provider !== "immich" || integration.status !== "active") return apiError("INTEGRATION_UNAVAILABLE", "Immich ist nicht aktiv", 409);
  const assetId = request.nextUrl.searchParams.get("assetId") ?? "";
  try {
    if (!await immichAssetBelongsToAlbum(integration, source.albumId, assetId)) return apiError("ASSET_NOT_FOUND", "Foto gehört nicht zum ausgewählten Album", 404);
    const image = await fetchImmichThumbnail(integration, assetId);
    return new NextResponse(Buffer.from(image.bytes), { headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError("IMAGE_FETCH_FAILED", error instanceof Error ? error.message : "Bild konnte nicht geladen werden", 502); }
}
