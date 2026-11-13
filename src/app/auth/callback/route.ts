import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Retorno dos links de e-mail do Supabase (confirmação de cadastro, recuperação de senha). */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/dashboard"}`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
