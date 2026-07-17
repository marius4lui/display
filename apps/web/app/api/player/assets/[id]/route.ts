import { NextRequest, NextResponse } from "next/server";
import { apiError } from "../../../../../lib/server/http";
import { playerDevice, requireDisplayHost } from "../../../../../lib/server/player";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wrongHost = requireDisplayHost(request); if (wrongHost) return wrongHost;
  const found = await playerDevice(request);
  if (!found) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const { data: asset } = await found.database.from("encrypted_assets").select("display_id, content_type, content_hash, ciphertext").eq("id", (await params).id).eq("display_id", found.device.display_id).maybeSingle();
  if (!asset) return apiError("NOT_FOUND", "Asset nicht gefunden", 404);
  const value = String(asset.ciphertext);
  const bytes = value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : Buffer.from(value, "base64");
  return new NextResponse(bytes, { headers: { "Content-Type": asset.content_type, ETag: `"${asset.content_hash}"`, "Cache-Control": "private, no-store" } });
}
