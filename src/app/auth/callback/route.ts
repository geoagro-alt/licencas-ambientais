import { NextResponse, type NextRequest } from "next/server";
import { destinoSeguro } from "@/lib/seguranca";
import { createClient } from "@/lib/supabase/server";

/** Retorno dos links de e-mail do Supabase (confirmação de cadastro, recuperação de senha). */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
