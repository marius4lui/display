import { NextResponse } from "next/server";
import { clearSessionCookies } from "../../../../lib/server/http";

export async function POST() {
  return clearSessionCookies(NextResponse.json({ ok: true }));
}
