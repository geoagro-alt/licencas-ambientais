import { addMonths, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Condicionante, Licenca } from "./types";

/** Data de hoje no fuso de Brasília, como "yyyy-MM-dd". */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function diasAte(dataISO: string | null, hoje = hojeISO()): number | null {
  if (!dataISO) return null;
  return differenceInCalendarDays(parseISO(dataISO), parseISO(hoje));
}

export function fmtData(dataISO: string | null | undefined): string {
  if (!dataISO) return "—";
  return format(parseISO(dataISO), "dd/MM/yyyy", { locale: ptBR });
}

export function fmtDias(d: number | null): string {
  if (d === null) return "sem prazo";
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence amanhã";
  if (d > 0) return `faltam ${d} dias`;
  if (d === -1) return "venceu ontem";
  return `venceu há ${-d} dias`;
}

/** Prazo-limite para protocolar a renovação (LC 140/2011: 120 dias antes do vencimento). */
export function limiteRenovacao(l: Pick<Licenca, "data_validade" | "antecedencia_renovacao_dias">): string | null {
  if (!l.data_validade) return null;
  return format(subDays(parseISO(l.data_validade), l.antecedencia_renovacao_dias ?? 120), "yyyy-MM-dd");
}

export function avancarPrazo(prazoISO: string, meses: number): string {
  return format(addMonths(parseISO(prazoISO), meses), "yyyy-MM-dd");
}

export type Nivel = "ok" | "atencao" | "critico" | "vencido" | "neutro";

export interface StatusLicenca {
  rotulo: string;
  nivel: Nivel;
  dias: number | null;
}

export function statusLicenca(
  l: Pick<Licenca, "data_validade" | "antecedencia_renovacao_dias" | "situacao" | "protocolo_renovacao">,
  hoje = hojeISO(),
): StatusLicenca {
  if (l.situacao === "encerrada") return { rotulo: "Encerrada", nivel: "neutro", dias: null };
  const dias = diasAte(l.data_validade, hoje);
  if (dias === null) return { rotulo: "Sem validade", nivel: "neutro", dias };
  if (l.situacao === "em_renovacao") {
    // Renovação protocolada no prazo: validade prorrogada até manifestação do órgão.
    return { rotulo: "Em renovação", nivel: "ok", dias };
  }
  if (dias < 0) return { rotulo: "Vencida", nivel: "vencido", dias };
  const diasLimite = diasAte(limiteRenovacao(l), hoje)!;
  if (diasLimite < 0) return { rotulo: "Renovação atrasada", nivel: "critico", dias };
  if (diasLimite <= 60) return { rotulo: "Renovar em breve", nivel: "atencao", dias };
  return { rotulo: "Vigente", nivel: "ok", dias };
}

export interface StatusCondicionante {
  rotulo: string;
  nivel: Nivel;
  dias: number | null;
}

export function statusCondicionante(
  c: Pick<Condicionante, "prazo" | "situacao" | "tipo">,
  hoje = hojeISO(),
): StatusCondicionante {
  if (c.situacao === "cumprida") return { rotulo: "Cumprida", nivel: "ok", dias: null };
  if (c.situacao === "nao_aplicavel") return { rotulo: "Não aplicável", nivel: "neutro", dias: null };
  const dias = diasAte(c.prazo, hoje);
  if (dias === null) {
    return c.tipo === "permanente"
      ? { rotulo: "Permanente", nivel: "neutro", dias }
      : { rotulo: "Sem prazo", nivel: "neutro", dias };
  }
  if (dias < 0) return { rotulo: "Atrasada", nivel: "vencido", dias };
  if (dias <= 15) return { rotulo: c.situacao === "em_andamento" ? "Em andamento" : "Prazo próximo", nivel: "critico", dias };
  if (dias <= 45) return { rotulo: c.situacao === "em_andamento" ? "Em andamento" : "Pendente", nivel: "atencao", dias };
  return { rotulo: c.situacao === "em_andamento" ? "Em andamento" : "Pendente", nivel: "ok", dias };
}

export const CORES_NIVEL: Record<Nivel, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  atencao: "bg-amber-50 text-amber-800 ring-amber-600/20",
  critico: "bg-orange-50 text-orange-700 ring-orange-600/30",
  vencido: "bg-red-50 text-red-700 ring-red-600/20",
  neutro: "bg-slate-50 text-slate-600 ring-slate-500/20",
};
