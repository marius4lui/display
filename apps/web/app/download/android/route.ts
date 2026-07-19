import { NextResponse } from "next/server";

export function GET() {
  const configured = process.env.ANDROID_APK_URL?.trim();
  if (!configured) return new NextResponse("Android download is not configured", { status: 404 });
  let target: URL;
  try { target = new URL(configured); }
  catch { return new NextResponse("Android download is not configured", { status: 404 }); }
  if (target.protocol !== "https:") return new NextResponse("Android download is not configured", { status: 404 });
  return NextResponse.redirect(target, 307);
}
