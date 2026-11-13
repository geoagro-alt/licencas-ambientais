import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Papel } from "./types";

export interface Contexto {
  userId: string;
  email: string;
  orgId: string;
  orgNome: string;
  papel: Papel;
  podeEditar: boolean;
}

/** Usuário logado + organização ativa. Redireciona para /login se não houver sessão. */
export const getContexto = cache(async (): Promise<Contexto> => {
  const supabase = await createClient();
  // getClaims valida o JWT sem ida extra ao servidor de Auth (o proxy já renovou a sessão)
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? "" };

  const buscarMembro = () =>
    supabase
      .from("membros")
      .select("org_id, papel, organizacoes(nome)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  let { data: membro } = await buscarMembro();

  if (!membro) {
    // Sem organização: aceita convites pendentes para este e-mail (primeiro acesso de convidado,
    // ou pessoa removida que foi convidada de novo).
    const { data: aceitou } = await supabase.rpc("aceitar_convite");
    if (aceitou) ({ data: membro } = await buscarMembro());
  }

  // Não redirecione para /login aqui: o proxy manda usuário logado de volta ao painel (laço infinito).
  if (!membro) redirect("/sem-organizacao");

  const org = membro.organizacoes as unknown as { nome: string } | null;
  const papel = membro.papel as Papel;
  return {
    userId: user.id,
    email: user.email ?? "",
    orgId: membro.org_id,
    orgNome: org?.nome ?? "Organização",
    papel,
    podeEditar: papel === "admin" || papel === "editor",
  };
});
