import { NextRequest, NextResponse } from "next/server";
import { apiError, clearSessionCookies, setSessionCookies } from "../../../../lib/server/http";
import { authClient, userContext } from "../../../../lib/server/supabase";

export async function GET(request: NextRequest) {
  const current = await userContext(request);
  if (current) return NextResponse.json({ user: { id: current.user.id, email: current.user.email } });
  const refresh = request.cookies.get("display-refresh-token")?.value;
  if (!refresh) return apiError("UNAUTHENTICATED", "Nicht angemeldet", 401);
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session || !data.user) return clearSessionCookies(apiError("SESSION_EXPIRED", "Sitzung abgelaufen", 401));
  return setSessionCookies(NextResponse.json({ user: { id: data.user.id, email: data.user.email } }), data.session);
}
