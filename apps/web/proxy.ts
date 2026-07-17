import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const value = process.env.PUBLIC_DISPLAY_URL?.trim();
  if (!value) return NextResponse.next();
  const displayHost = new URL(value).host.toLowerCase();
  const host = (request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    ?? request.headers.get("host")
    ?? "").toLowerCase();
  const path = request.nextUrl.pathname;
  if (host !== displayHost) {
    if (path === "/player" || path.startsWith("/api/player/")) return new NextResponse("Not Found", { status: 404 });
    return NextResponse.next();
  }
  if (path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/player";
    return NextResponse.rewrite(url);
  }
  if (path.startsWith("/api/player/") || path.startsWith("/_next/") || path === "/favicon.ico") {
    return NextResponse.next();
  }
  return new NextResponse("Not Found", { status: 404 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
