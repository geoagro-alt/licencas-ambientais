import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Gera um link temporário (5 min) para baixar um documento — respeita o RLS do usuário logado. */
export async function GET(_req: Request, ctx: RouteContext<"/api/documentos/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documentos").select("storage_path, nome").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.storage_path, 300, { download: doc.nome });
  if (error || !data) return NextResponse.json({ erro: error?.message ?? "falha" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
