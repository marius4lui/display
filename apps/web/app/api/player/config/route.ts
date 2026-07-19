import { NextRequest, NextResponse } from "next/server";
import type { DashboardDocument } from "../../../../lib/dashboard";
import { apiError, sha256 } from "../../../../lib/server/http";
import { clearPlayerCookie, playerDevice, requireDisplayHost } from "../../../../lib/server/player";

export async function GET(request: NextRequest) {
  const wrongHost = requireDisplayHost(request); if (wrongHost) return wrongHost;
  const found = await playerDevice(request);
  if (!found) return clearPlayerCookie(apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401));
  const { database, device } = found;
  const { data: display } = await database.from("displays").select("id, owner_id, public_id, active_version").eq("id", device.display_id).maybeSingle();
  if (!display?.active_version) return apiError("NOT_PUBLISHED", "Kein veröffentlichtes Dashboard", 404);
  const { data: version } = await database.from("display_versions").select("version, document, published_at").eq("display_id", display.id).eq("version", display.active_version).maybeSingle();
  if (!version?.document) return apiError("LEGACY_VERSION", "Diese Dashboard-Version wird nicht unterstützt", 409);
  const document = structuredClone(version.document) as DashboardDocument;
  const cameraSourceIds = new Set(document.dataSources.filter((source) => source.type === "home_assistant" && source.resource === "camera").map((source) => source.id));
  document.dataSources = (document.dataSources ?? []).map((source) => ({
    id: source.id, name: source.name, refreshSeconds: source.refreshSeconds,
    type: source.type ?? "rest", method: "GET", url: "", headers: {}, auth: { type: "none" },
  })) as DashboardDocument["dataSources"];
  document.actions = (document.actions ?? []).map((action) => ({
    id: action.id, name: action.name, confirmation: action.confirmation !== false, cooldownMs: action.cooldownMs ?? 2000,
  })) as DashboardDocument["actions"];
  const studioOrigin = new URL(process.env.PUBLIC_APP_URL ?? request.url).origin;
  for (const page of document.pages) {
    for (const widget of page.widgets) {
      if (widget.dataSourceId && cameraSourceIds.has(widget.dataSourceId)) widget.imageUrl = `/api/player/images/${encodeURIComponent(widget.dataSourceId)}`;
      if (!widget.imageUrl) continue;
      try {
        const image = new URL(widget.imageUrl, studioOrigin);
        const match = image.pathname.match(/^\/assets\/([0-9a-f-]{36})$/i);
        if (image.origin === studioOrigin && match) widget.imageUrl = `/api/player/assets/${match[1]}`;
      } catch { /* Relative/external URLs remain unchanged. */ }
    }
  }
  const payload = { id: display.public_id, version: version.version, publishedAt: version.published_at, document };
  const etag = `"${sha256(JSON.stringify(payload))}"`;
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-store" } });
  await database.from("display_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
  return NextResponse.json(payload, { headers: { ETag: etag, "Cache-Control": "private, no-store" } });
}
