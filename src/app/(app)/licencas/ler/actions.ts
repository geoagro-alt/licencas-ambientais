"use server";

import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { TIPOS_ACEITOS, type DadosExtraidos } from "@/lib/extracao-ia";
import { extrairLicenca, iaConfigurada, limiteBytes } from "@/lib/ia";
import { chaveNome } from "@/lib/importacao";
import { createClient } from "@/lib/supabase/server";

export interface OpcaoEmpresa {
  id: string;
  razao_social: string;
  cnpj_cpf: string | null;
  empreendimentos: { id: string; nome: string }[];
}

export type ResultadoAnalise =
  | { ok: true; dados: DadosExtraidos; empresas: OpcaoEmpresa[]; empresaId: string; empreendimentoId: string }
  | { ok: false; erro: string };

const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Lê o arquivo (já enviado ao Storage pelo navegador) com a IA e sugere empresa/empreendimento existentes. */
export async function analisarDocumento(arquivo: { storage_path: string; mime: string }): Promise<ResultadoAnalise> {
  try {
    const ctx = await getContexto();
    if (!ctx.podeEditar) return { ok: false, erro: "Seu usuário não tem permissão para cadastrar licenças." };
    if (!iaConfigurada()) {
      return { ok: false, erro: "A leitura por IA ainda não foi ativada: falta configurar a variável GEMINI_API_KEY (grátis) ou ANTHROPIC_API_KEY na Vercel." };
    }
    if (!arquivo.storage_path.startsWith(`${ctx.orgId}/`)) return { ok: false, erro: "Arquivo inválido." };
    const tipo = TIPOS_ACEITOS[arquivo.mime];
    if (!tipo) return { ok: false, erro: "Formato não suportado. Envie PDF, JPG, PNG ou WEBP." };

    const supabase = await createClient();
    const { data: blob, error } = await supabase.storage.from("documentos").download(arquivo.storage_path);
    if (error || !blob) return { ok: false, erro: `Não consegui abrir o arquivo: ${error?.message ?? "desconhecido"}` };
    if (blob.size > limiteBytes()) {
      return { ok: false, erro: `Arquivo muito grande para a leitura por IA (máx. ${Math.round(limiteBytes() / 1024 / 1024)} MB). Envie só as páginas da licença.` };
    }
    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

    const [dados, { data: empresasDb }] = await Promise.all([
      extrairLicenca(base64, tipo, arquivo.mime),
      supabase.from("empresas").select("id, razao_social, cnpj_cpf, empreendimentos(id, nome)").eq("org_id", ctx.orgId).order("razao_social"),
    ]);
    const empresas = (empresasDb ?? []) as OpcaoEmpresa[];

    // sugere empresa por CPF/CNPJ ou nome; empreendimento por nome
    const doc = soDigitos(dados.empresa_cnpj);
    const empresa =
      (doc.length >= 11 ? empresas.find((e) => soDigitos(e.cnpj_cpf) === doc) : undefined) ??
      (dados.empresa_nome ? empresas.find((e) => chaveNome(e.razao_social) === chaveNome(dados.empresa_nome)) : undefined);
    const empreendimento = empresa && dados.empreendimento_nome
      ? empresa.empreendimentos.find((p) => chaveNome(p.nome) === chaveNome(dados.empreendimento_nome))
      : undefined;

    return { ok: true, dados, empresas, empresaId: empresa?.id ?? "", empreendimentoId: empreendimento?.id ?? "" };
  } catch (e) {
    const msg = (e as { message?: string }).message ?? String(e);
    if (/credit balance|billing/i.test(msg)) return { ok: false, erro: "A conta da Anthropic está sem créditos. Adicione créditos em platform.claude.com." };
    if (/authentication_error|invalid x-api-key/i.test(msg)) return { ok: false, erro: "A chave ANTHROPIC_API_KEY é inválida. Confira a configuração na Vercel." };
    return { ok: false, erro: msg.startsWith("A ") || msg.startsWith("Limite") || msg.startsWith("Gemini") ? msg : `Falha na leitura: ${msg}` };
  }
}

export interface DadosRevisados extends DadosExtraidos {
  empresa_id: string; // "" = criar nova
  empreendimento_id: string; // "" = criar novo
  responsavel_id: string;
  arquivo: { storage_path: string; nome: string; mime: string; tamanho: number };
}

/** Grava empresa/empreendimento (se novos), a licença, as condicionantes marcadas e anexa o documento lido. */
export async function salvarLeitura(d: DadosRevisados): Promise<{ ok: true; licencaId: string } | { ok: false; erro: string }> {
  try {
    const ctx = await getContexto();
    if (!ctx.podeEditar) return { ok: false, erro: "Sem permissão." };
    if (!d.arquivo.storage_path.startsWith(`${ctx.orgId}/`)) return { ok: false, erro: "Arquivo inválido." };
    const supabase = await createClient();
    const org = ctx.orgId;
    const nul = (v: string) => (v && v.trim() ? v.trim() : null);

    let empresaId = d.empresa_id;
    if (!empresaId) {
      if (!nul(d.empresa_nome)) return { ok: false, erro: "Informe o nome do cliente." };
      const { data, error } = await supabase
        .from("empresas")
        .insert({ org_id: org, razao_social: d.empresa_nome.trim(), cnpj_cpf: nul(d.empresa_cnpj) })
        .select("id")
        .single();
      if (error) throw error;
      empresaId = data.id;
    }

    let empId = d.empreendimento_id;
    if (!empId) {
      const { data, error } = await supabase
        .from("empreendimentos")
        .insert({
          org_id: org,
          empresa_id: empresaId,
          nome: nul(d.empreendimento_nome) ?? d.empresa_nome.trim(),
          atividade: nul(d.descricao),
          municipio: nul(d.municipio),
          uf: nul(d.uf),
          car: nul(d.car),
          latitude: d.latitude,
          longitude: d.longitude,
        })
        .select("id")
        .single();
      if (error) throw error;
      empId = data.id;
    }

    const { data: lic, error: e3 } = await supabase
      .from("licencas")
      .insert({
        org_id: org,
        empreendimento_id: empId,
        tipo: d.tipo || "Outro",
        numero: nul(d.numero),
        processo: nul(d.processo),
        orgao: nul(d.orgao),
        descricao: nul(d.descricao),
        data_emissao: nul(d.data_emissao),
        data_validade: nul(d.data_validade),
        antecedencia_renovacao_dias: Number.isFinite(d.antecedencia_renovacao_dias) ? d.antecedencia_renovacao_dias : 120,
        responsavel_id: nul(d.responsavel_id),
        observacoes: nul(d.observacoes),
      })
      .select("id")
      .single();
    if (e3) throw e3;

    const conds = d.condicionantes
      .filter((c) => c.incluir && c.descricao.trim())
      .map((c) => ({
        org_id: org,
        licenca_id: lic.id,
        numero: nul(c.numero),
        descricao: c.descricao.trim(),
        tipo: c.tipo,
        periodicidade_meses: c.tipo === "periodica" ? (c.periodicidade_meses ?? 12) : null,
        prazo: c.tipo === "permanente" ? null : nul(c.prazo),
      }));
    if (conds.length) {
      const { error } = await supabase.from("condicionantes").insert(conds);
      if (error) throw error;
    }

    await supabase.from("documentos").insert({
      org_id: org,
      licenca_id: lic.id,
      nome: d.arquivo.nome,
      storage_path: d.arquivo.storage_path,
      tamanho_bytes: d.arquivo.tamanho,
      mime_type: d.arquivo.mime,
      user_id: ctx.userId,
    });

    revalidatePath("/", "layout");
    return { ok: true, licencaId: lic.id };
  } catch (e) {
    return { ok: false, erro: (e as { message?: string }).message ?? String(e) };
  }
}
