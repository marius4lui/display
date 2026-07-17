import { NextRequest, NextResponse } from "next/server";
import { clearPlayerCookie, playerDevice, requireDisplayHost } from "../../../../lib/server/player";

export async function POST(request: NextRequest) {
  const wrongHost = requireDisplayHost(request); if (wrongHost) return wrongHost;
  const found = await playerDevice(request);
  if (found) await found.database.from("display_devices").update({ revoked_at: new Date().toISOString() }).eq("id", found.device.id);
  return clearPlayerCookie(new NextResponse(null, { status: 204 }));
}
