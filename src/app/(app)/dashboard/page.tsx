import Link from "next/link";
import { AlertTriangle, CalendarClock, ClipboardCheck, FileBadge, Plus, Sparkles } from "lucide-react";
import { Badge, Card, LinkButton, PageHeader, Vazio } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { listarCondicionantes, listarLicencas } from "@/lib/dados";
import { coletarPrazos, type Prazo } from "@/lib/agenda";
import { fmtData, fmtDias, statusCondicionante, statusLicenca, type Nivel } from "@/lib/prazos";

export default async function DashboardPage() {
  const ctx = await getContexto();
  const [licencas, conds] = await Promise.all([listarLicencas(ctx.orgId), listarCondicionantes(ctx.orgId)]);

  const ativas = licencas.filter((l) => l.situacao !== "encerrada");
  const stL = ativas.map((l) => ({ l, s: statusLicenca(l) }));
  const vencidas = stL.filter((x) => x.s.nivel === "vencido").length;
  const atencao = stL.filter((x) => x.s.nivel === "atencao" || x.s.nivel === "critico").length;
  const emRenovacao = ativas.filter((l) => l.situacao === "em_renovacao").length;

  const condsAbertas = conds.filter((c) => (c.situacao === "pendente" || c.situacao === "em_andamento") && c.licencas?.situacao !== "encerrada");
  const condsAtrasadas = condsAbertas.filter((c) => statusCondicionante(c).nivel === "vencido").length;

  const conformidade =
    ativas.length + condsAbertas.length === 0
      ? 100
      : Math.round((1 - (vencidas + condsAtrasadas) / (ativas.length + condsAbertas.length)) * 100);

  // Linha do tempo: próximos 90 dias + vencidos
  const prazos = coletarPrazos(ativas, condsAbertas);
  const linha = prazos.filter((p) => p.dias <= 90);
  const atrasados = linha.filter((p) => p.dias < 0);
  const proximos = linha.filter((p) => p.dias >= 0);

  return (
    <>
      <PageHeader
        titulo="Painel"
        subtitulo={`Situação de hoje · ${ctx.orgNome}`}
        acoes={
          ctx.podeEditar && (
            <>
              <LinkButton href="/licencas/ler" variante="secundario">
                <Sparkles className="h-4 w-4" /> Ler documento com IA
              </LinkButton>
              <LinkButton href="/licencas/nova">
                <Plus className="h-4 w-4" /> Nova licença
              </LinkButton>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={FileBadge} rotulo="Licenças ativas" valor={ativas.length} extra={`${emRenovacao} em renovação`} href="/licencas" />
        <Kpi icon={CalendarClock} rotulo="Precisam de atenção" valor={atencao} extra="renovar em breve ou atrasadas" href="/licencas?status=alerta" tom={atencao ? "amber" : undefined} />
        <Kpi icon={AlertTriangle} rotulo="Licenças vencidas" valor={vencidas} extra="sem protocolo de renovação" href="/licencas?status=vencido" tom={vencidas ? "red" : undefined} />
        <Kpi
          icon={ClipboardCheck}
          rotulo="Condicionantes em aberto"
          valor={condsAbertas.length}
          extra={`${condsAtrasadas} atrasada(s)`}
          href="/condicionantes"
          tom={condsAtrasadas ? "red" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {atrasados.length > 0 && (
            <Card titulo={<span className="text-red-700">Atrasados ({atrasados.length})</span>}>
              <ListaPrazos itens={atrasados} />
            </Card>
          )}
          <Card titulo="Próximos 90 dias">
            {proximos.length === 0 ? <Vazio>Nenhum prazo nos próximos 90 dias. 🎉</Vazio> : <ListaPrazos itens={proximos} />}
          </Card>
        </div>

        <div className="space-y-6">
          <Card titulo="Índice de conformidade">
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-semibold ${conformidade >= 90 ? "text-emerald-700" : conformidade >= 70 ? "text-amber-600" : "text-red-600"}`}>{conformidade}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${conformidade >= 90 ? "bg-emerald-600" : conformidade >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${conformidade}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-500">Licenças e condicionantes em aberto que não estão vencidas/atrasadas.</p>
          </Card>
          <Card titulo="Por cliente">
            <PorEmpresa licencas={stL} />
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  rotulo,
  valor,
  extra,
  href,
  tom,
}: {
  icon: React.ComponentType<{ className?: string }>;
  rotulo: string;
  valor: number;
  extra: string;
  href: string;
  tom?: "red" | "amber";
}) {
  const cor = tom === "red" ? "text-red-600" : tom === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
        {rotulo}
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className={`mt-2 text-3xl font-semibold ${cor}`}>{valor}</div>
      <div className="text-xs text-slate-500">{extra}</div>
    </Link>
  );
}

function ListaPrazos({ itens }: { itens: Prazo[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {itens.slice(0, 40).map((p, i) => (
        <li key={i}>
          <Link href={p.href} className="flex items-start gap-4 py-3 hover:bg-slate-50">
            <div className="w-20 shrink-0 text-right">
              <div className="text-sm font-semibold text-slate-800">{fmtData(p.data).slice(0, 5)}</div>
              <div className="text-xs text-slate-500">{fmtData(p.data).slice(6)}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge nivel={p.nivel}>{p.tipo}</Badge>
                <span className="text-xs text-slate-500">{fmtDias(p.dias)}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{p.titulo}</div>
              <div className="truncate text-xs text-slate-500">{p.sub}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PorEmpresa({ licencas }: { licencas: { l: { empreendimentos: { empresas: { id: string; razao_social: string } | null } | null }; s: { nivel: Nivel } }[] }) {
  const mapa = new Map<string, { id: string; nome: string; total: number; alerta: number }>();
  for (const { l, s } of licencas) {
    const e = l.empreendimentos?.empresas;
    if (!e) continue;
    const r = mapa.get(e.id) ?? { id: e.id, nome: e.razao_social, total: 0, alerta: 0 };
    r.total++;
    if (s.nivel === "vencido" || s.nivel === "critico" || s.nivel === "atencao") r.alerta++;
    mapa.set(e.id, r);
  }
  const lista = [...mapa.values()].sort((a, b) => b.alerta - a.alerta || b.total - a.total);
  if (!lista.length) return <p className="text-sm text-slate-500">Sem licenças ainda.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {lista.slice(0, 12).map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-2">
          <Link href={`/clientes/${e.id}`} className="truncate hover:text-emerald-700">
            {e.nome}
          </Link>
          <span className="shrink-0 text-xs text-slate-500">
            {e.total} lic.{e.alerta > 0 && <span className="ml-1 font-medium text-amber-600">· {e.alerta} alerta(s)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
