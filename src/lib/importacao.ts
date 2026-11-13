/**
 * Importação de licenças a partir de planilha (Excel/CSV).
 * Lógica pura (sem I/O): recebe a planilha como matriz de células e devolve linhas normalizadas.
 *
 * Formatos reconhecidos automaticamente pelos nomes das colunas:
 *  - exportação de outros sistemas de licenciamento ("Tipo da Licença", "Empreendedor", "Licenciador", "Vencimento", "Renovação", "Situação", "codigo"…)
 *  - o CSV exportado por este próprio sistema ("Empresa", "Empreendimento", "Tipo", "Número", "Órgão", "Validade"…)
 */

import { differenceInCalendarDays, parseISO } from "date-fns";
import { TIPOS_LICENCA } from "./types";

export type Celula = string | number | boolean | Date | null | undefined;

export interface LinhaImportada {
  linha: number; // nº da linha na planilha (para mensagens)
  empresa: string;
  empreendimento: string;
  municipio: string | null;
  uf: string | null;
  tipo: string;
  numero: string | null;
  processo: string | null;
  orgao: string | null;
  descricao: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  antecedencia_renovacao_dias: number;
  situacao: "ativa" | "em_renovacao" | "encerrada";
  observacoes: string | null;
  codigo_externo: string | null;
}

export interface ResultadoLeitura {
  linhas: LinhaImportada[];
  avisos: string[];
  colunasReconhecidas: string[];
  colunasIgnoradas: string[];
}

// ------------------------------------------------------------------ utilidades

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function texto(v: Celula): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  if (s === "" || s === "-" || s === "—" || s === "null" || s === "undefined") return null;
  return s;
}

const iso = (y: number, m: number, d: number) => {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // ex.: 31/02
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** Aceita Date, nº serial do Excel, "dd/mm/aaaa", "dd-mm-aa", "aaaa-mm-dd" e "dd/mm/aaaa (texto)". */
export function parseData(v: Celula): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === "number") {
    if (v < 1 || v > 120000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    return iso(y, parseInt(m[2], 10), parseInt(m[1], 10));
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  return null;
}

/** Converte o nome do tipo para um dos tipos padrão do sistema (mantém o original quando não reconhece). */
export function mapearTipo(bruto: string | null): string {
  if (!bruto) return "Outro";
  const n = normalizar(bruto);
  const t = (prefixo: string) => TIPOS_LICENCA.find((x) => x.startsWith(prefixo)) ?? bruto;
  if (/dispensa/.test(n) || /uso insignificante/.test(n)) return t("Dispensa de outorga");
  if (/outorga/.test(n)) return t("Outorga");
  if (/atividade rural/.test(n)) return t("LAR – Licença de Atividade Rural");
  if (/ambiental rural/.test(n) || /^lar\b/.test(n)) return t("LAR – Licença Ambiental Rural");
  if (/previa e (de )?instalacao/.test(n) || /^lp ?\/ ?li\b/.test(n)) return t("LP/LI");
  if (/previa/.test(n) || /^lp\b/.test(n)) return t("LP –");
  if (/instalacao/.test(n) || /^li\b/.test(n)) return t("LI –");
  if (/operacao/.test(n) || /^lo\b/.test(n)) return t("LO –");
  if (/simplificada/.test(n) || /^las\b/.test(n)) return t("LAS –");
  if (/unica/.test(n) || /^lau\b/.test(n)) return t("LAU –");
  if (/adesao/.test(n) || /^lac\b/.test(n)) return t("LAC –");
  if (/supressao/.test(n) || /^asv\b/.test(n)) return t("ASV –");
  if (/autorizacao/.test(n) || /^aua?\b/.test(n)) return t("AuA –");
  if (/\bctf\b/.test(n) || /cadastro tecnico federal/.test(n)) return t("CTF/IBAMA");
  if (/cadri/.test(n)) return t("CADRI");
  if (/\bcar\b/.test(n) || /cadastro ambiental rural/.test(n)) return t("CAR –");
  if (/alvara/.test(n)) return t("Alvará");
  if (/\bmapa\b/.test(n)) return t("Registro MAPA");
  if (/bombeiro|avcb/.test(n)) return t("AVCB");
  // tipo desconhecido: mantém o texto original, com capitalização tratada
  return bruto === bruto.toUpperCase() ? bruto.charAt(0) + bruto.slice(1).toLowerCase() : bruto;
}

function mapearSituacao(bruto: string | null): { situacao: LinhaImportada["situacao"]; nota: string | null } {
  if (!bruto) return { situacao: "ativa", nota: null };
  const n = normalizar(bruto);
  if (/fora do prazo/.test(n)) return { situacao: "em_renovacao", nota: "Protocolo de renovação feito fora do prazo." };
  if (/protocol|renovacao|em analise/.test(n)) return { situacao: "em_renovacao", nota: null };
  if (/encerrad|cancelad|arquivad|substituid|baixad|inativ/.test(n)) return { situacao: "encerrada", nota: null };
  return { situacao: "ativa", nota: null }; // emitida, vigente, vencida, expirada, alerta…
}

// ------------------------------------------------------------------ cabeçalhos

type Campo =
  | "empresa" | "empreendimento" | "municipio" | "uf" | "tipo" | "numero" | "processo" | "orgao"
  | "descricao" | "emissao" | "validade" | "renovacao" | "antecedencia" | "situacao" | "complemento"
  | "observacoes" | "codigo";

/** Nomes de coluna aceitos para cada campo (já normalizados). */
const ALIASES: Record<Campo, string[]> = {
  empresa: ["empreendedor", "empresa", "razao social", "cliente", "titular", "requerente", "interessado", "proprietario"],
  empreendimento: ["empreendimento", "fazenda", "unidade", "imovel", "propriedade", "estabelecimento"],
  municipio: ["cidade", "municipio"],
  uf: ["uf", "estado"],
  tipo: ["tipo da licenca", "tipo de licenca", "tipo", "tipo licenca", "modalidade", "documento"],
  numero: ["numero da licenca", "numero", "n licenca", "no licenca", "n da licenca", "licenca"],
  processo: ["numero do processo", "processo", "n processo", "no processo", "n do processo"],
  orgao: ["licenciador", "orgao", "orgao emissor", "orgao licenciador", "emissor"],
  descricao: ["descricao", "atividade", "objeto", "atividade licenciada"],
  emissao: ["emissao", "data de emissao", "data emissao", "emitida em"],
  validade: ["vencimento", "validade", "data de validade", "data de vencimento", "vence em", "valida ate"],
  renovacao: ["renovacao", "data de renovacao", "protocolar renovacao ate", "prazo de renovacao", "prazo renovacao"],
  antecedencia: ["antecedencia", "antecedencia renovacao", "antecedencia p renovacao dias", "dias de antecedencia"],
  situacao: ["situacao", "status"],
  complemento: ["informacoes complementares", "complemento"],
  observacoes: ["observacoes", "observacao", "obs"],
  codigo: ["codigo", "id", "identificador", "codigo externo"],
};

function mapearCabecalho(cab: Celula[]) {
  const mapa = new Map<Campo, number>();
  const reconhecidas: string[] = [];
  const ignoradas: string[] = [];
  cab.forEach((c, i) => {
    const original = texto(c);
    if (!original) return;
    const n = normalizar(original);
    const campo = (Object.keys(ALIASES) as Campo[]).find((k) => ALIASES[k].includes(n));
    if (campo && !mapa.has(campo)) {
      mapa.set(campo, i);
      reconhecidas.push(original);
    } else {
      ignoradas.push(original);
    }
  });
  return { mapa, reconhecidas, ignoradas };
}

/** Procura a linha de cabeçalho nas primeiras 10 linhas (a que reconhece mais colunas). */
function acharCabecalho(matriz: Celula[][]) {
  let melhor = { indice: 0, ...mapearCabecalho(matriz[0] ?? []) };
  for (let i = 1; i < Math.min(10, matriz.length); i++) {
    const m = mapearCabecalho(matriz[i]);
    if (m.mapa.size > melhor.mapa.size) melhor = { indice: i, ...m };
  }
  return melhor;
}

// ------------------------------------------------------------------ leitura

export function interpretarPlanilha(matriz: Celula[][]): ResultadoLeitura {
  const avisos: string[] = [];
  if (!matriz.length) return { linhas: [], avisos: ["A planilha está vazia."], colunasReconhecidas: [], colunasIgnoradas: [] };

  const { indice, mapa, reconhecidas, ignoradas } = acharCabecalho(matriz);
  const faltando = (["empresa", "tipo", "validade"] as Campo[]).filter((c) => !mapa.has(c));
  if (!mapa.has("empresa") && !mapa.has("empreendimento")) {
    return {
      linhas: [],
      avisos: ['Não encontrei a coluna da empresa (ex.: "Empresa" ou "Empreendedor"). Confira o cabeçalho da planilha.'],
      colunasReconhecidas: reconhecidas,
      colunasIgnoradas: ignoradas,
    };
  }
  if (faltando.includes("validade")) avisos.push('Coluna de validade/vencimento não encontrada — as licenças serão importadas sem prazo.');
  if (faltando.includes("tipo")) avisos.push('Coluna de tipo não encontrada — as licenças serão importadas como "Outro".');

  const get = (linha: Celula[], campo: Campo) => (mapa.has(campo) ? linha[mapa.get(campo)!] : undefined);
  const linhas: LinhaImportada[] = [];

  for (let r = indice + 1; r < matriz.length; r++) {
    const linha = matriz[r] ?? [];
    if (linha.every((c) => texto(c) === null && !(c instanceof Date) && typeof c !== "number")) continue;
    const nLinha = r + 1;

    const empresa = texto(get(linha, "empresa")) ?? texto(get(linha, "empreendimento"));
    if (!empresa) {
      avisos.push(`Linha ${nLinha}: sem empresa/empreendedor — ignorada.`);
      continue;
    }
    const complemento = texto(get(linha, "complemento"));
    const empreendimento = texto(get(linha, "empreendimento")) ?? empresa;

    const validadeBruta = get(linha, "validade");
    const data_validade = parseData(validadeBruta as Celula);
    if (validadeBruta && texto(validadeBruta as Celula) && !data_validade && !(validadeBruta instanceof Date)) {
      avisos.push(`Linha ${nLinha}: data de validade "${texto(validadeBruta as Celula)}" não reconhecida.`);
    }

    // antecedência: coluna explícita, ou diferença entre vencimento e data de renovação
    let antecedencia = 120;
    const antTxt = texto(get(linha, "antecedencia"));
    const renovacao = parseData(get(linha, "renovacao") as Celula);
    if (antTxt && /^\d+$/.test(antTxt)) antecedencia = parseInt(antTxt, 10);
    else if (renovacao && data_validade) {
      const d = differenceInCalendarDays(parseISO(data_validade), parseISO(renovacao));
      if (d >= 0 && d <= 730) antecedencia = d;
    }

    const sit = mapearSituacao(texto(get(linha, "situacao")));
    const obs = [texto(get(linha, "observacoes")), sit.nota, complemento && complemento !== empreendimento ? complemento : null]
      .filter(Boolean)
      .join("\n");

    let uf = texto(get(linha, "uf"));
    if (uf && uf.length !== 2) uf = null;

    linhas.push({
      linha: nLinha,
      empresa,
      empreendimento,
      municipio: texto(get(linha, "municipio")),
      uf: uf?.toUpperCase() ?? null,
      tipo: mapearTipo(texto(get(linha, "tipo"))),
      numero: texto(get(linha, "numero")),
      processo: texto(get(linha, "processo")),
      orgao: texto(get(linha, "orgao")),
      descricao: texto(get(linha, "descricao")),
      data_emissao: parseData(get(linha, "emissao") as Celula),
      data_validade,
      antecedencia_renovacao_dias: antecedencia,
      situacao: sit.situacao,
      observacoes: obs || null,
      codigo_externo: texto(get(linha, "codigo")),
    });
  }

  if (!linhas.length) avisos.push("Nenhuma licença encontrada na planilha.");
  return { linhas, avisos, colunasReconhecidas: reconhecidas, colunasIgnoradas: ignoradas };
}

/** Lê CSV (separador ; , ou tab, com aspas) em matriz de células. */
export function lerCSV(conteudo: string): Celula[][] {
  const txt = conteudo.replace(/^﻿/, "");
  const primeira = txt.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].sort((a, b) => primeira.split(b).length - primeira.split(a).length)[0];
  const linhas: Celula[][] = [];
  let campo = "";
  let linha: Celula[] = [];
  let aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (aspas) {
      if (c === '"' && txt[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/** Chave para comparar nomes de empresas/empreendimentos sem diferença de maiúsculas, acentos e espaços. */
export const chaveNome = (s: string) => normalizar(s);
