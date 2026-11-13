/**
 * Leitura de licenças por IA — parte pura (sem I/O).
 * Define o formato que pedimos ao Claude (ferramenta com JSON Schema) e normaliza a resposta
 * em dados prontos para a tela de revisão. A chamada à API fica em src/lib/ia.ts.
 */

import { addDays, addMonths, format, parseISO } from "date-fns";
import { mapearTipo, parseData } from "./importacao";

export const PROMPT_SISTEMA = `Você é um especialista em licenciamento ambiental brasileiro (LC 140/2011, CONAMA 237/97, normas estaduais e municipais).
Recebe o documento de uma licença, autorização, outorga, dispensa, CAR, CTF, alvará ou similar (PDF ou foto) e extrai os dados para cadastro em um sistema de controle de prazos.

Regras:
- Use somente o que está no documento. Se um campo não aparece ou está ilegível, devolva null — nunca invente.
- Datas no formato AAAA-MM-DD. Se a validade vier como período ("válida por 4 anos a partir da emissão"), preencha validade_meses e deixe data_validade como null, a menos que a data também esteja escrita.
- Antecedência para renovação: só preencha se o documento disser (ex.: "requerer a renovação com antecedência mínima de 120 dias").
- Condicionantes: transcreva TODAS, na ordem, com o número do documento (ex.: "2.1"). Mantenha o texto fiel, apenas corrigindo quebras de linha.
  - tipo "periodica" para obrigações recorrentes (anual, semestral, trimestral, mensal…), com periodicidade_meses (12, 6, 3, 1…).
  - tipo "unica" para obrigações a cumprir uma vez (ex.: "apresentar em 90 dias").
  - tipo "permanente" para obrigações contínuas sem data (ex.: "manter", "não lançar", "respeitar").
  - Prazo: se houver data explícita, prazo_data. Se for relativo à emissão ("no prazo de 60 dias"), prazo_dias_apos_emissao. Se for relativo em meses, prazo_meses_apos_emissao.
- Coordenadas em graus decimais (negativas para Sul/Oeste). Se estiverem em UTM ou outro formato, deixe null e mencione em observacoes.
- Em observacoes, liste em poucas linhas qualquer ponto de atenção (campos ilegíveis, páginas faltando, dúvidas).`;

export const FERRAMENTA = {
  name: "registrar_licenca",
  description: "Registra os dados extraídos do documento de licença ambiental.",
  input_schema: {
    type: "object" as const,
    properties: {
      tipo_documento: { type: ["string", "null"], description: 'Tipo como escrito no documento, ex.: "Licença de Operação", "Outorga de direito de uso"' },
      numero: { type: ["string", "null"] },
      processo: { type: ["string", "null"], description: "Número do processo administrativo" },
      orgao: { type: ["string", "null"], description: "Órgão emissor, ex.: SEMA-MT, IBAMA, SEMMA de Paragominas" },
      data_emissao: { type: ["string", "null"], description: "AAAA-MM-DD" },
      data_validade: { type: ["string", "null"], description: "AAAA-MM-DD" },
      validade_meses: { type: ["integer", "null"], description: "Quando a validade é dada como período a partir da emissão" },
      antecedencia_renovacao_dias: { type: ["integer", "null"] },
      atividade: { type: ["string", "null"], description: "Atividade/objeto licenciado, com capacidade/área se houver" },
      empreendedor: {
        type: "object",
        properties: {
          nome: { type: ["string", "null"], description: "Razão social ou nome do titular/empreendedor" },
          cpf_cnpj: { type: ["string", "null"] },
        },
        required: ["nome", "cpf_cnpj"],
      },
      empreendimento: {
        type: "object",
        properties: {
          nome: { type: ["string", "null"], description: "Nome da fazenda/unidade/estabelecimento" },
          municipio: { type: ["string", "null"] },
          uf: { type: ["string", "null"], description: "Sigla com 2 letras" },
          car: { type: ["string", "null"], description: "Número do CAR, se houver" },
          latitude: { type: ["number", "null"] },
          longitude: { type: ["number", "null"] },
        },
        required: ["nome", "municipio", "uf", "car", "latitude", "longitude"],
      },
      condicionantes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            numero: { type: ["string", "null"] },
            descricao: { type: "string" },
            tipo: { type: "string", enum: ["unica", "periodica", "permanente"] },
            periodicidade_meses: { type: ["integer", "null"] },
            prazo_data: { type: ["string", "null"], description: "AAAA-MM-DD" },
            prazo_dias_apos_emissao: { type: ["integer", "null"] },
            prazo_meses_apos_emissao: { type: ["integer", "null"] },
          },
          required: ["numero", "descricao", "tipo", "periodicidade_meses", "prazo_data", "prazo_dias_apos_emissao", "prazo_meses_apos_emissao"],
        },
      },
      observacoes: { type: ["string", "null"] },
    },
    required: [
      "tipo_documento", "numero", "processo", "orgao", "data_emissao", "data_validade", "validade_meses",
      "antecedencia_renovacao_dias", "atividade", "empreendedor", "empreendimento", "condicionantes", "observacoes",
    ],
  },
};

// ------------------------------------------------------------------ resposta da IA → dados da tela

export interface CondicionanteExtraida {
  incluir: boolean;
  numero: string;
  descricao: string;
  tipo: "unica" | "periodica" | "permanente";
  periodicidade_meses: number | null;
  prazo: string; // AAAA-MM-DD ou ""
}

export interface DadosExtraidos {
  tipo: string;
  numero: string;
  processo: string;
  orgao: string;
  data_emissao: string;
  data_validade: string;
  antecedencia_renovacao_dias: number;
  descricao: string;
  empresa_nome: string;
  empresa_cnpj: string;
  empreendimento_nome: string;
  municipio: string;
  uf: string;
  car: string;
  latitude: number | null;
  longitude: number | null;
  condicionantes: CondicionanteExtraida[];
  observacoes: string;
}

type Bruto = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const int = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? Math.round(v) : typeof v === "string" && /^\d+$/.test(v.trim()) ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const coord = (v: unknown, lim: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim && v !== 0 ? v : null);
const data = (v: unknown) => (typeof v === "string" ? parseData(v) : null);

export function normalizarExtracao(bruto: Bruto): DadosExtraidos {
  const emp = (bruto.empreendedor ?? {}) as Bruto;
  const local = (bruto.empreendimento ?? {}) as Bruto;
  const emissao = data(bruto.data_emissao);
  let validade = data(bruto.data_validade);
  const meses = int(bruto.validade_meses, 1, 240);
  if (!validade && emissao && meses) validade = format(addMonths(parseISO(emissao), meses), "yyyy-MM-dd");

  const condicionantes: CondicionanteExtraida[] = (Array.isArray(bruto.condicionantes) ? bruto.condicionantes : [])
    .map((c: Bruto) => {
      const tipo = c.tipo === "periodica" || c.tipo === "permanente" ? c.tipo : "unica";
      const per = tipo === "periodica" ? (int(c.periodicidade_meses, 1, 120) ?? 12) : null;
      let prazo = data(c.prazo_data);
      const dias = int(c.prazo_dias_apos_emissao, 0, 3650);
      const mesesApos = int(c.prazo_meses_apos_emissao, 0, 240);
      if (!prazo && emissao && dias !== null) prazo = format(addDays(parseISO(emissao), dias), "yyyy-MM-dd");
      if (!prazo && emissao && mesesApos !== null) prazo = format(addMonths(parseISO(emissao), mesesApos), "yyyy-MM-dd");
      // periódica sem data: primeira entrega = emissão + periodicidade
      if (!prazo && emissao && tipo === "periodica" && per) prazo = format(addMonths(parseISO(emissao), per), "yyyy-MM-dd");
      return {
        incluir: true,
        numero: s(c.numero),
        descricao: typeof c.descricao === "string" ? c.descricao.trim() : "",
        tipo,
        periodicidade_meses: per,
        prazo: tipo === "permanente" ? "" : (prazo ?? ""),
      } as CondicionanteExtraida;
    })
    .filter((c) => c.descricao.length > 0);

  const uf = s(local.uf).toUpperCase();
  const tipoOriginal = s(bruto.tipo_documento);

  return {
    tipo: mapearTipo(tipoOriginal || null),
    numero: s(bruto.numero),
    processo: s(bruto.processo),
    orgao: s(bruto.orgao),
    data_emissao: emissao ?? "",
    data_validade: validade ?? "",
    antecedencia_renovacao_dias: int(bruto.antecedencia_renovacao_dias, 0, 730) ?? 120,
    descricao: s(bruto.atividade),
    empresa_nome: s(emp.nome),
    empresa_cnpj: s(emp.cpf_cnpj),
    empreendimento_nome: s(local.nome),
    municipio: s(local.municipio),
    uf: /^[A-Z]{2}$/.test(uf) ? uf : "",
    car: s(local.car),
    latitude: coord(local.latitude, 90),
    longitude: coord(local.longitude, 180),
    condicionantes,
    observacoes: typeof bruto.observacoes === "string" ? bruto.observacoes.trim() : "",
  };
}

/** Tipos de arquivo aceitos pela leitura por IA. */
export const TIPOS_ACEITOS: Record<string, "pdf" | "imagem"> = {
  "application/pdf": "pdf",
  "image/jpeg": "imagem",
  "image/png": "imagem",
  "image/webp": "imagem",
  "image/gif": "imagem",
};
