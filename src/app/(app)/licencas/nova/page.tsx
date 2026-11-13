import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { listarEmpreendimentos, listarMembros } from "@/lib/dados";
import { createClient } from "@/lib/supabase/server";
import { FormLicenca } from "../form-licenca";

export default async function NovaLicencaPage({ searchParams }: PageProps<"/licencas/nova">) {
  const ctx = await getContexto();
  if (!ctx.podeEditar) redirect("/licencas");
  const sp = await searchParams;
  const [empreendimentos, membros] = await Promise.all([listarEmpreendimentos(ctx.orgId), listarMembros(ctx.orgId)]);

  let padrao = typeof sp.empreendimento === "string" ? sp.empreendimento : undefined;
  if (!padrao && typeof sp.empresa === "string") {
    const supabase = await createClient();
    const { data } = await supabase.from("empreendimentos").select("id").eq("empresa_id", sp.empresa).limit(1).maybeSingle();
    padrao = data?.id;
  }

  return (
    <>
      <PageHeader titulo="Nova licença" subtitulo="Licença, autorização, outorga, registro ou qualquer documento com prazo" />
      <FormLicenca empreendimentos={empreendimentos} membros={membros} empreendimentoPadrao={padrao} />
    </>
  );
}
