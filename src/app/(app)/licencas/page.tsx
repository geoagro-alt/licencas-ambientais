import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Badge, Button, Card, Input, LinkButton, PageHeader, Select, Tabela, Td, Th, Vazio } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { listarLicencas, siglaTipo } from "@/lib/dados";
import { fmtData, fmtDias, limiteRenovacao, statusLicenca, type Nivel } from "@/lib/prazos";

const FILTROS: { v: string; rotulo: string; niveis: Nivel[] }[] = [
  { v: "", rotulo: "Todas", niveis: [] },
  { v: "alerta", rotulo: "Precisam de atenção", niveis: ["atencao", "critico", "vencido"] },
  { v: "vencido", rotulo: "Vencidas", niveis: ["vencido"] },
  { v: "ok", rotulo: "Em dia", niveis: ["ok"] },
  { v: "neutro", rotulo: "Sem validade / encerradas", niveis: ["neutro"] },
];

export default async function LicencasPage({ searchParams }: PageProps<"/licencas">) {
  const ctx = await getContexto();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const filtro = FILTROS.find((f) => f.v === sp.status) ?? FILTROS[0];

  const todas = await listarLicencas(ctx.orgId);
  const licencas = todas
    .map((l) => ({ ...l, status: statusLicenca(l) }))
    .filter((l) => (filtro.niveis.length ? filtro.niveis.includes(l.status.nivel) : true))
    .filter((l) =>
      q
        ? [l.tipo, l.numero, l.orgao, l.processo, l.empreendimentos?.nome, l.empreendimentos?.empresas?.razao_social, l.empreendimentos?.municipio]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true,
    );

  return (
    <>
      <PageHeader
        titulo="Licenças"
        subtitulo={`${todas.length} cadastrada(s)`}
        acoes={
          <>
            <LinkButton href="/api/exportar?tipo=licencas" variante="secundario" prefetch={false}>
              <Download className="h-4 w-4" /> Exportar CSV
            </LinkButton>
            {ctx.podeEditar && (
              <LinkButton href="/licencas/nova">
                <Plus className="h-4 w-4" /> Nova licença
              </LinkButton>
            )}
          </>
        }
      />

      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <Input name="q" defaultValue={q} placeholder="Buscar por número, empresa, empreendimento, órgão…" className="max-w-sm" />
          <Select name="status" defaultValue={filtro.v} className="max-w-56">
            {FILTROS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.rotulo}
              </option>
            ))}
          </Select>
          <Button variante="secundario" type="submit">
            Filtrar
          </Button>
        </form>

        {licencas.length === 0 ? (
          <Vazio>
            {todas.length === 0 ? (
              <>
                Nenhuma licença cadastrada.{" "}
                {ctx.podeEditar && (
                  <Link href="/licencas/nova" className="text-emerald-700 hover:underline">
                    Cadastrar a primeira
                  </Link>
                )}
              </>
            ) : (
              "Nenhuma licença encontrada com esses filtros."
            )}
          </Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Licença</Th>
                <Th>Empresa / empreendimento</Th>
                <Th>Órgão</Th>
                <Th>Validade</Th>
                <Th>Protocolar renovação até</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {licencas.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/licencas/${l.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                      {siglaTipo(l.tipo)}
                      {l.numero && ` nº ${l.numero}`}
                    </Link>
                    {l.processo && <div className="text-xs text-slate-500">Proc. {l.processo}</div>}
                  </Td>
                  <Td>
                    <div>{l.empreendimentos?.empresas?.razao_social}</div>
                    <div className="text-xs text-slate-500">{l.empreendimentos?.nome}</div>
                  </Td>
                  <Td>{l.orgao ?? "—"}</Td>
                  <Td>
                    {fmtData(l.data_validade)}
                    {l.status.dias !== null && <div className="text-xs text-slate-500">{fmtDias(l.status.dias)}</div>}
                  </Td>
                  <Td>{l.situacao === "ativa" ? fmtData(limiteRenovacao(l)) : l.protocolo_renovacao ? `Prot. ${l.protocolo_renovacao}` : "—"}</Td>
                  <Td>
                    <Badge nivel={l.status.nivel}>{l.status.rotulo}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Card>
    </>
  );
}
