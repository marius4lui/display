import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../lib/server/display";
import { apiError } from "../../../../../lib/server/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const { data, error } = await found.context.database.rpc("publish_display", { target_display: found.display.id });
  return error ? apiError("PUBLISH_FAILED", error.message, 409) : NextResponse.json({ version: data, displayUrl: `${new URL(request.url).origin}/d/${found.display.public_id}` }, { status: 201 });
}
