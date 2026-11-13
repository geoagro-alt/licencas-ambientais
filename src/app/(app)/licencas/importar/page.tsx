import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { Importador } from "./importador";

export default async function ImportarPage() {
  const ctx = await getContexto();
  if (!ctx.podeEditar) redirect("/licencas");
  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link href="/licencas" className="hover:text-slate-800">
          Licenças
        </Link>{" "}
        / Importar
      </div>
      <PageHeader
        titulo="Importar planilha"
        subtitulo="Traga as licenças que você já controla em Excel ou em outro sistema. Clientes e empreendimentos são cadastrados automaticamente."
      />
      <Importador />
    </>
  );
}
