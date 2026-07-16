import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const url = () => process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anon = () => process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const adminClient = () => createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
export const authClient = () => createClient(url(), anon(), { auth: { persistSession: false, autoRefreshToken: false } });

export async function userContext(request: NextRequest) {
  const accessToken = request.cookies.get("display-access-token")?.value;
  if (!accessToken) return null;
  const auth = authClient();
  const { data: { user }, error } = await auth.auth.getUser(accessToken);
  if (error || !user) return null;
  const database = createClient(url(), anon(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  return { user, database, accessToken };
}
