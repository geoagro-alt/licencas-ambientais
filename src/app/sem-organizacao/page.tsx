import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sair } from "../login/actions";

/** Usuário logado sem vínculo com nenhuma organização (foi removido, ou o convite foi cancelado). */
export default async function SemOrganizacaoPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  // convite novo desde a última visita? entra direto
  const { data: aceitou } = await supabase.rpc("aceitar_convite");
  if (aceitou) redirect("/dashboard");
  const { data: membro } = await supabase.from("membros").select("org_id").eq("user_id", claims.sub).limit(1).maybeSingle();
  if (membro) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <Logo size={48} className="mx-auto mb-3" />
        <h1 className="text-lg font-semibold">Sem acesso a uma organização</h1>
        <p className="mt-2 text-sm text-slate-600">
          O e-mail <b>{(claims.email as string | undefined) ?? ""}</b> não está vinculado a nenhuma organização. Peça ao administrador para convidar este
          e-mail em Configurações → Equipe e depois recarregue esta página.
        </p>
        <form action={sair} className="mt-5">
          <Button type="submit" variante="secundario" className="w-full">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
