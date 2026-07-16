import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../lib/server/display";
import { apiError } from "../../../../../lib/server/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const bytes = Buffer.from(await request.arrayBuffer()); if (!bytes.length) return apiError("ASSET_MISSING", "Asset fehlt"); if (bytes.length > 20 * 1024 * 1024) return apiError("ASSET_TOO_LARGE", "Asset ist größer als 20 MB", 413);
  const id = randomUUID(); const contentHash = createHash("sha256").update(bytes).digest("hex");
  const { error } = await found.context.database.from("encrypted_assets").insert({ id, display_id: found.display.id, content_type: request.headers.get("x-asset-type") ?? "application/octet-stream", byte_size: bytes.length, content_hash: contentHash, ciphertext: `\\x${bytes.toString("hex")}` });
  return error ? apiError("UPLOAD_FAILED", "Asset konnte nicht gespeichert werden", 500) : NextResponse.json({ id, url: `${new URL(request.url).origin}/assets/${id}`, contentHash }, { status: 201 });
}
