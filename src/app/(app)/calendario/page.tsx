import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageHeader, cx } from "@/components/ui";
import { coletarPrazos } from "@/lib/agenda";
import { getContexto } from "@/lib/contexto";
import { listarCondicionantes, listarLicencas } from "@/lib/dados";
import { CORES_NIVEL, hojeISO } from "@/lib/prazos";

export default async function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  const ctx = await getContexto();
  const sp = await searchParams;
  const hoje = hojeISO();
  const mesParam = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : hoje.slice(0, 7);
  const ref = parseISO(`${mesParam}-01`);

  const [licencas, conds] = await Promise.all([listarLicencas(ctx.orgId), listarCondicionantes(ctx.orgId)]);
  const prazos = coletarPrazos(licencas, conds);
  const porDia = new Map<string, typeof prazos>();
  for (const p of prazos) porDia.set(p.data, [...(porDia.get(p.data) ?? []), p]);

  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(ref), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(ref), { weekStartsOn: 0 }),
  });
  const ant = format(addMonths(ref, -1), "yyyy-MM");
  const prox = format(addMonths(ref, 1), "yyyy-MM");
  const doMes = prazos.filter((p) => p.data.startsWith(mesParam));

  return (
    <>
      <PageHeader
        titulo="Calendário"
        subtitulo={
          <>
            Vencimentos, prazos de renovação e condicionantes. Quer no Google Agenda/Outlook? Veja o link em{" "}
            <Link href="/configuracoes" className="text-emerald-700 hover:underline">
              Configurações
            </Link>
            .
          </>
        }
      />
      <Card
        titulo={(() => { const t = format(ref, "MMMM 'de' yyyy", { locale: ptBR }); return t.charAt(0).toUpperCase() + t.slice(1); })()}
        acoes={
          <div className="flex items-center gap-1">
            <Link href={`/calendario?m=${ant}`} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href="/calendario" className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
              Hoje
            </Link>
            <Link href={`/calendario?m=${prox}`} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-500">
              {d}
            </div>
          ))}
          {dias.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const itens = porDia.get(iso) ?? [];
            const fora = !iso.startsWith(mesParam);
            return (
              <div key={iso} className={cx("min-h-24 bg-white p-1.5", fora && "bg-slate-50/70")}>
                <div className={cx("mb-1 text-xs", iso === hoje ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 font-semibold text-white" : fora ? "text-slate-300" : "text-slate-500")}>
                  {format(d, "d")}
                </div>
                <div className="space-y-1">
                  {itens.slice(0, 3).map((p, i) => (
                    <Link
                      key={i}
                      href={p.href}
                      title={`${p.tipo}: ${p.titulo} — ${p.sub}`}
                      className={cx("block truncate rounded px-1 py-0.5 text-[11px] ring-1 ring-inset", CORES_NIVEL[p.nivel])}
                    >
                      {p.tipo.startsWith("Condicionante") ? "◆ " : p.tipo === "Vencimento" ? "● " : "▲ "}
                      {p.titulo}
                    </Link>
                  ))}
                  {itens.length > 3 && <div className="text-[11px] text-slate-500">+{itens.length - 3} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>● Vencimento da licença</span>
          <span>▲ Prazo para protocolar renovação</span>
          <span>◆ Condicionante</span>
          <span className="ml-auto">{doMes.length} prazo(s) neste mês</span>
        </div>
      </Card>
    </>
  );
}
