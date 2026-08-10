import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_URL are required for admin access.");
  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
