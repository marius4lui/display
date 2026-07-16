import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const publicId = () => randomBytes(9).toString("base64url");
export const apiError = (code: string, message: string, status = 400) => NextResponse.json({ error: { code, message } }, { status });

export async function jsonBody(request: Request) {
  try { return await request.json() as Record<string, unknown>; }
  catch { return null; }
}

export function setSessionCookies(response: NextResponse, session: { access_token: string; refresh_token: string; expires_in: number }) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("display-access-token", session.access_token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: session.expires_in });
  response.cookies.set("display-refresh-token", session.refresh_token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set("display-access-token", "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("display-refresh-token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
