import { NextResponse } from "next/server";

const latestApk = "https://github.com/marius4lui/display/releases/latest/download/display.apk";

export function GET() {
  return NextResponse.redirect(latestApk, 307);
}
