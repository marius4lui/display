import { NextRequest, NextResponse } from "next/server";
import type { DashboardDocument, DataSource } from "../../../lib/dashboard";
import { resolveDataSourceForClient } from "../../../lib/server/data-source";
import { apiError, sha256 } from "../../../lib/server/http";
import { adminClient } from "../../../lib/server/supabase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get("authorization"); if (!authorization?.startsWith("Bearer ")) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe erforderlich", 401);
  const id = (await params).id; const admin = adminClient();
  const { data: display } = await admin.from("displays").select("id, owner_id, public_id, active_version").eq("public_id", id).maybeSingle();
  if (!display?.active_version) return apiError("NOT_FOUND", "Kein veröffentlichtes Dashboard", 404);
  const { data: device } = await admin.from("display_devices").select("id").eq("display_id", display.id).eq("token_hash", sha256(authorization.slice(7))).is("revoked_at", null).maybeSingle();
  if (!device) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const { data: version, error: versionError } = await admin.from("display_versions").select("version, document, content_hash, published_at").eq("display_id", display.id).eq("version", display.active_version).maybeSingle();
  if (versionError) return apiError("DATABASE_ERROR", `Version konnte nicht geladen werden: ${versionError.message}`, 500);
  if (!version?.document) return apiError("LEGACY_VERSION", "Diese alte verschlüsselte Version wird nicht mehr unterstützt", 409);
  const document = structuredClone(version.document) as DashboardDocument;
  try {
    document.dataSources = await Promise.all(
      (document.dataSources ?? []).map((source: DataSource) => resolveDataSourceForClient(source, display.owner_id, admin)),
    );
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "Datenquellen konnten nicht aufgelöst werden";
    return apiError("SOURCE_CONFIGURATION_ERROR", message, 500);
  }
  const payload = { id, version: version.version, publishedAt: version.published_at, document };
  const etag = `\"${sha256(JSON.stringify(payload))}\"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-store" } });
  }
  await admin.from("display_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
  return NextResponse.json(payload, { headers: { ETag: etag, "Cache-Control": "private, no-store" } });
}
