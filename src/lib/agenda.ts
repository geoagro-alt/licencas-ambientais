import type { CondicionanteCompleta, LicencaCompleta } from "./dados";
import { diasAte, limiteRenovacao, type Nivel } from "./prazos";

export interface Prazo {
  data: string;
  dias: number;
  tipo: string;
  titulo: string;
  sub: string;
  href: string;
  nivel: Nivel;
}

const sigla = (t: string) => t.split(" – ")[0];
export const nivelPorDias = (d: number): Nivel => (d < 0 ? "vencido" : d <= 15 ? "critico" : d <= 45 ? "atencao" : "ok");

/** Junta todos os prazos em aberto (vencimentos, renovações e condicionantes) numa lista única. */
export function coletarPrazos(licencas: LicencaCompleta[], conds: CondicionanteCompleta[]): Prazo[] {
  const prazos: Prazo[] = [];
  for (const l of licencas) {
    if (l.situacao !== "ativa" || !l.data_validade) continue;
    const nome = `${sigla(l.tipo)}${l.numero ? ` nº ${l.numero}` : ""}`;
    const sub = `${l.empreendimentos?.empresas?.razao_social ?? ""} · ${l.empreendimentos?.nome ?? ""}`;
    const d = diasAte(l.data_validade)!;
    prazos.push({ data: l.data_validade, dias: d, tipo: "Vencimento", titulo: nome, sub, href: `/licencas/${l.id}`, nivel: nivelPorDias(d) });
    const lim = limiteRenovacao(l);
    if (lim && d >= 0 && !l.protocolo_renovacao && l.antecedencia_renovacao_dias > 0) {
      const dl = diasAte(lim)!;
      prazos.push({ data: lim, dias: dl, tipo: "Protocolar renovação", titulo: nome, sub, href: `/licencas/${l.id}`, nivel: nivelPorDias(dl) });
    }
  }
  for (const c of conds) {
    if (!c.prazo || !(c.situacao === "pendente" || c.situacao === "em_andamento") || c.licencas?.situacao === "encerrada") continue;
    const d = diasAte(c.prazo)!;
    prazos.push({
      data: c.prazo,
      dias: d,
      tipo: `Condicionante ${c.numero ?? ""}`.trim(),
      titulo: c.descricao,
      sub: `${c.licencas ? sigla(c.licencas.tipo) : ""} ${c.licencas?.numero ?? ""} · ${c.licencas?.empreendimentos?.nome ?? ""}`,
      href: `/licencas/${c.licenca_id}`,
      nivel: nivelPorDias(d),
    });
  }
  return prazos.sort((a, b) => a.dias - b.dias);
}
