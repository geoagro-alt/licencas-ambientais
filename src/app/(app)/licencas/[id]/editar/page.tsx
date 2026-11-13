import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { listarEmpreendimentos, listarMembros } from "@/lib/dados";
import { createClient } from "@/lib/supabase/server";
import type { Licenca } from "@/lib/types";
import { FormLicenca } from "../../form-licenca";

export default async function EditarLicencaPage({ params }: PageProps<"/licencas/[id]/editar">) {
  const { id } = await params;
  const ctx = await getContexto();
  if (!ctx.podeEditar) redirect(`/licencas/${id}`);
  const supabase = await createClient();
  const { data: licenca } = await supabase.from("licencas").select("*").eq("id", id).maybeSingle<Licenca>();
  if (!licenca) notFound();
  const [empreendimentos, membros] = await Promise.all([listarEmpreendimentos(ctx.orgId), listarMembros(ctx.orgId)]);

  return (
    <>
      <PageHeader titulo="Editar licença" />
      <FormLicenca licenca={licenca} empreendimentos={empreendimentos} membros={membros} />
    </>
  );
}
