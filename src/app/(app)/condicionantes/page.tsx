import Link from "next/link";
import { Download } from "lucide-react";
import { Badge, Button, Card, Input, LinkButton, PageHeader, Select, Tabela, Td, Th, Vazio } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { listarCondicionantes, listarMembros, nomeMembro, siglaTipo } from "@/lib/dados";
import { fmtData, fmtDias, statusCondicionante, type Nivel } from "@/lib/prazos";

const FILTROS: { v: string; rotulo: string; teste: (n: Nivel, sit: string) => boolean }[] = [
  { v: "", rotulo: "Em aberto", teste: (_, s) => s === "pendente" || s === "em_andamento" },
  { v: "atrasadas", rotulo: "Atrasadas", teste: (n) => n === "vencido" },
  { v: "proximas", rotulo: "Vencem em até 45 dias", teste: (n, s) => (n === "critico" || n === "atencao") && s !== "cumprida" },
  { v: "cumpridas", rotulo: "Cumpridas", teste: (_, s) => s === "cumprida" },
  { v: "todas", rotulo: "Todas", teste: () => true },
];

export default async function CondicionantesPage({ searchParams }: PageProps<"/condicionantes">) {
  const ctx = await getContexto();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const resp = typeof sp.resp === "string" ? sp.resp : "";
  const filtro = FILTROS.find((f) => f.v === (sp.f ?? "")) ?? FILTROS[0];

  const [todas, membros] = await Promise.all([listarCondicionantes(ctx.orgId), listarMembros(ctx.orgId)]);
  const conds = todas
    .filter((c) => c.licencas?.situacao !== "encerrada" || filtro.v === "todas")
    .map((c) => ({ ...c, st: statusCondicionante(c) }))
    .filter((c) => filtro.teste(c.st.nivel, c.situacao))
    .filter((c) => (resp ? (c.responsavel_id ?? c.licencas?.responsavel_id) === resp : true))
    .filter((c) =>
      q
        ? [c.numero, c.descricao, c.licencas?.numero, c.licencas?.empreendimentos?.nome, c.licencas?.empreendimentos?.empresas?.razao_social]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true,
    );

  return (
    <>
      <PageHeader
        titulo="Condicionantes"
        subtitulo="Todas as obrigações das licenças em um só lugar. Para registrar o cumprimento, abra a licença."
        acoes={
          <LinkButton href="/api/exportar?tipo=condicionantes" variante="secundario" prefetch={false}>
            <Download className="h-4 w-4" /> Exportar CSV
          </LinkButton>
        }
      />
      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <Input name="q" defaultValue={q} placeholder="Buscar…" className="max-w-xs" />
          <Select name="f" defaultValue={filtro.v} className="max-w-56">
            {FILTROS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.rotulo}
              </option>
            ))}
          </Select>
          <Select name="resp" defaultValue={resp} className="max-w-56">
            <option value="">Todos os responsáveis</option>
            {membros.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.nome || m.email}
              </option>
            ))}
          </Select>
          <Button type="submit" variante="secundario">
            Filtrar
          </Button>
        </form>

        {conds.length === 0 ? (
          <Vazio>Nenhuma condicionante encontrada.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Prazo</Th>
                <Th>Condicionante</Th>
                <Th>Licença</Th>
                <Th>Responsável</Th>
                <Th>Situação</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conds.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">
                    {fmtData(c.prazo)}
                    {c.st.dias !== null && <div className="text-xs text-slate-500">{fmtDias(c.st.dias)}</div>}
                  </Td>
                  <Td className="max-w-lg">
                    {c.numero && <span className="mr-1 font-medium">{c.numero}</span>}
                    <span className="line-clamp-3">{c.descricao}</span>
                  </Td>
                  <Td>
                    <Link href={`/licencas/${c.licenca_id}`} className="font-medium hover:text-emerald-700">
                      {c.licencas && siglaTipo(c.licencas.tipo)} {c.licencas?.numero && `nº ${c.licencas.numero}`}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {c.licencas?.empreendimentos?.empresas?.razao_social} · {c.licencas?.empreendimentos?.nome}
                    </div>
                  </Td>
                  <Td>{nomeMembro(membros, c.responsavel_id ?? c.licencas?.responsavel_id ?? null)}</Td>
                  <Td>
                    <Badge nivel={c.st.nivel}>{c.st.rotulo}</Badge>
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
