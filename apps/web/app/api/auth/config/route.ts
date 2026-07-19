import { NextResponse } from "next/server";
import { publicAuthConfig } from "../../../../lib/server/auth-config";

export async function GET() { return NextResponse.json(publicAuthConfig(), { headers: { "Cache-Control": "no-store" } }); }
