import { diasAte, hojeISO, limiteRenovacao } from "./prazos";

/**
 * Lógica pura de seleção de alertas (sem I/O) — fácil de testar.
 *
 * Regra: cada item tem uma data de referência. Para os "marcos" configurados (ex.: 120, 90, 60, 30, 15, 7, 1, 0 dias),
 * o item entra no aviso quando cruza um marco ainda não avisado. Se o cron falhar um dia, o próximo envio
 * recupera o marco perdido (não depende de "bater exatamente" no dia).
 * Depois de vencido, o item volta a ser avisado uma vez por semana até ser resolvido.
 */

export type EntidadeAlerta = "licenca" | "renovacao" | "condicionante";

export interface ItemAlerta {
  entidade: EntidadeAlerta;
  id: string;            // id da licença ou condicionante
  licencaId: string;     // para montar o link
  dataReferencia: string;
  titulo: string;        // ex.: "LO nº 123/2024 — Fazenda Boa Vista"
  detalhe: string;       // ex.: "Vencimento da licença" / texto da condicionante
  empresa: string;
  responsavelId: string | null;
}

export interface ItemSelecionado extends ItemAlerta {
  dias: number;
  marco: number;
}

/** Marco a avisar para um item a `dias` do vencimento; null = fora da janela de aviso. */
export function marcoPara(dias: number, marcos: number[]): number | null {
  if (dias < 0) {
    // vencido: um marco por semana (-1, -8, -15, ...)
    return -1 - Math.floor((-dias - 1) / 7) * 7;
  }
  const ordenados = [...new Set(marcos)].filter((m) => m >= 0).sort((a, b) => a - b);
  for (const m of ordenados) if (dias <= m) return m;
  return null;
}

export const chaveAlerta = (entidade: string, id: string, dataRef: string, marco: number) =>
  `${entidade}:${id}:${dataRef}:${marco}`;

export function selecionarAlertas(
  itens: ItemAlerta[],
  marcos: number[],
  jaEnviados: Set<string>,
  hoje = hojeISO(),
): ItemSelecionado[] {
  const out: ItemSelecionado[] = [];
  for (const item of itens) {
    const dias = diasAte(item.dataReferencia, hoje);
    if (dias === null) continue;
    const marco = marcoPara(dias, marcos);
    if (marco === null) continue;
    if (jaEnviados.has(chaveAlerta(item.entidade, item.id, item.dataReferencia, marco))) continue;
    out.push({ ...item, dias, marco });
  }
  return out.sort((a, b) => a.dias - b.dias);
}

// ---------------------------------------------------------------------------
// Conversão das linhas do banco em itens de alerta
// ---------------------------------------------------------------------------

export interface LinhaLicenca {
  id: string;
  tipo: string;
  numero: string | null;
  data_validade: string | null;
  antecedencia_renovacao_dias: number;
  situacao: string;
  protocolo_renovacao: string | null;
  responsavel_id: string | null;
  empreendimentos: { nome: string; empresas: { razao_social: string } | null } | null;
}

export interface LinhaCondicionante {
  id: string;
  licenca_id: string;
  numero: string | null;
  descricao: string;
  prazo: string | null;
  situacao: string;
  responsavel_id: string | null;
  licencas: LinhaLicenca | null;
}

export function tituloLicenca(l: Pick<LinhaLicenca, "tipo" | "numero" | "empreendimentos">) {
  const sigla = l.tipo.split(" – ")[0];
  return `${sigla}${l.numero ? ` nº ${l.numero}` : ""} — ${l.empreendimentos?.nome ?? ""}`;
}

export function itensDeLicencas(licencas: LinhaLicenca[], hoje = hojeISO()): ItemAlerta[] {
  const itens: ItemAlerta[] = [];
  for (const l of licencas) {
    if (l.situacao !== "ativa" || !l.data_validade) continue;
    const base = {
      licencaId: l.id,
      id: l.id,
      titulo: tituloLicenca(l),
      empresa: l.empreendimentos?.empresas?.razao_social ?? "",
      responsavelId: l.responsavel_id,
    };
    itens.push({ ...base, entidade: "licenca", dataReferencia: l.data_validade, detalhe: "Vencimento da licença" });
    const limite = limiteRenovacao(l);
    // depois de vencida, só o alerta de vencimento continua (evita aviso duplicado)
    const jaVencida = (diasAte(l.data_validade, hoje) ?? 0) < 0;
    if (limite && !jaVencida && !l.protocolo_renovacao && l.antecedencia_renovacao_dias > 0) {
      itens.push({
        ...base,
        entidade: "renovacao",
        dataReferencia: limite,
        detalhe: `Prazo para protocolar a renovação (${l.antecedencia_renovacao_dias} dias antes do vencimento)`,
      });
    }
  }
  return itens;
}

export function itensDeCondicionantes(conds: LinhaCondicionante[]): ItemAlerta[] {
  return conds
    .filter((c) => c.prazo && (c.situacao === "pendente" || c.situacao === "em_andamento") && c.licencas?.situacao !== "encerrada")
    .map((c) => ({
      entidade: "condicionante" as const,
      id: c.id,
      licencaId: c.licenca_id,
      dataReferencia: c.prazo!,
      titulo: c.licencas ? tituloLicenca(c.licencas) : "",
      detalhe: `Condicionante${c.numero ? ` ${c.numero}` : ""}: ${c.descricao}`,
      empresa: c.licencas?.empreendimentos?.empresas?.razao_social ?? "",
      responsavelId: c.responsavel_id ?? c.licencas?.responsavel_id ?? null,
    }));
}

// ---------------------------------------------------------------------------
// Distribuição por destinatário
// ---------------------------------------------------------------------------

export interface MembroAlerta {
  user_id: string;
  email: string;
  papel: string;
  receber_alertas: boolean;
}

/**
 * Admins (com alertas ligados) e e-mails extras recebem tudo.
 * Editores/leitores recebem só os itens em que são responsáveis.
 */
export function distribuir(itens: ItemSelecionado[], membros: MembroAlerta[], emailsExtras: string[]) {
  const porEmail = new Map<string, ItemSelecionado[]>();
  const add = (email: string, lista: ItemSelecionado[]) => {
    if (!email || lista.length === 0) return;
    const k = email.trim().toLowerCase();
    const atual = porEmail.get(k) ?? [];
    for (const i of lista) if (!atual.includes(i)) atual.push(i);
    porEmail.set(k, atual);
  };
  for (const m of membros) {
    if (!m.receber_alertas) continue;
    if (m.papel === "admin") add(m.email, itens);
    else add(m.email, itens.filter((i) => i.responsavelId === m.user_id));
  }
  for (const e of emailsExtras) add(e, itens);
  for (const [k, lista] of porEmail) porEmail.set(k, lista.sort((a, b) => a.dias - b.dias));
  return porEmail;
}
