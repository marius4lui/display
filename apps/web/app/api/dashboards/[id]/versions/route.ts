import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../lib/server/display";
import { apiError } from "../../../../../lib/server/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const { data, error } = await found.context.database.from("display_versions").select("version, content_hash, byte_size, published_at").eq("display_id", found.display.id).order("version", { ascending: false });
  if (error) return apiError("DATABASE_ERROR", "Versionen konnten nicht geladen werden", 500);
  return NextResponse.json({ versions: (data ?? []).map(v => ({ version: v.version, contentHash: v.content_hash, byteSize: v.byte_size, publishedAt: v.published_at, active: v.version === found.display.active_version })) });
}
