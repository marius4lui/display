import { NextRequest, NextResponse } from "next/server";
import { apiError, sha256 } from "../../../lib/server/http";
import { adminClient } from "../../../lib/server/supabase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get("authorization"); if (!authorization?.startsWith("Bearer ")) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe erforderlich", 401);
  const admin = adminClient(); const { data: asset } = await admin.from("encrypted_assets").select("display_id, content_type, content_hash, ciphertext").eq("id", (await params).id).maybeSingle();
  if (!asset) return apiError("NOT_FOUND", "Asset nicht gefunden", 404);
  const { data: device } = await admin.from("display_devices").select("id").eq("display_id", asset.display_id).eq("token_hash", sha256(authorization.slice(7))).is("revoked_at", null).maybeSingle();
  if (!device) return apiError("DEVICE_UNAUTHORIZED", "Gerätefreigabe ungültig oder widerrufen", 401);
  const value = String(asset.ciphertext); const bytes = value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : Buffer.from(value, "base64");
  return new NextResponse(bytes, { headers: { "Content-Type": "application/octet-stream", "X-Asset-Type": asset.content_type, ETag: `\"${asset.content_hash}\"`, "Cache-Control": "public, max-age=31536000, immutable" } });
}
