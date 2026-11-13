import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { listarMembros } from "@/lib/dados";
import { iaConfigurada, limiteBytes } from "@/lib/ia";
import { LeitorIA } from "./leitor";

// a leitura de um PDF longo pode levar até ~1 minuto
export const maxDuration = 120;

export default async function LerDocumentoPage() {
  const ctx = await getContexto();
  if (!ctx.podeEditar) redirect("/licencas");
  const membros = await listarMembros(ctx.orgId);

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link href="/licencas" className="hover:text-slate-800">
          Licenças
        </Link>{" "}
        / Ler documento com IA
      </div>
      <PageHeader
        titulo="Ler documento com IA"
        subtitulo="Envie o PDF ou a foto da licença: a IA preenche empresa, empreendimento, prazos e todas as condicionantes para você revisar."
      />
      <LeitorIA orgId={ctx.orgId} membros={membros} iaAtiva={iaConfigurada()} maxBytes={limiteBytes()} />
    </>
  );
}
