import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a service_role key — IGNORA o RLS.
 * Use apenas em rotas de servidor sem usuário logado (cron de alertas, feed ICS).
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
