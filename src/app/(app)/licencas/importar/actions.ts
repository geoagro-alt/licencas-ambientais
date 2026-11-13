"use server";

import { revalidatePath } from "next/cache";
import { subMonths, format } from "date-fns";
import { getContexto } from "@/lib/contexto";
import { chaveNome, type LinhaImportada } from "@/lib/importacao";
import { hojeISO } from "@/lib/prazos";
import { createClient } from "@/lib/supabase/server";

export interface ResumoImportacao {
  ok: boolean;
  erro?: string;
  empresasCriadas: number;
  empreendimentosCriados: number;
  licencasCriadas: number;
  licencasAtualizadas: number;
  encerradas: number;
}

const LIMITE = 5000;

/**
 * Grava as linhas já interpretadas no navegador (src/lib/importacao.ts).
 * - Empresas e empreendimentos são reaproveitados quando o nome bate (ignorando maiúsculas/acentos).
 * - Licenças com o mesmo `codigo_externo` (ou mesmo empreendimento + tipo + número) são atualizadas, não duplicadas.
 */
export async function importarLicencas(
  linhas: LinhaImportada[],
  opcoes: { encerrarVencidasHaMeses: number | null },
): Promise<ResumoImportacao> {
  const resumo: ResumoImportacao = { ok: false, empresasCriadas: 0, empreendimentosCriados: 0, licencasCriadas: 0, licencasAtualizadas: 0, encerradas: 0 };
  try {
    const ctx = await getContexto();
    if (!ctx.podeEditar) return { ...resumo, erro: "Seu usuário não tem permissão para importar." };
    if (!Array.isArray(linhas) || linhas.length === 0) return { ...resumo, erro: "Nenhuma linha para importar." };
    if (linhas.length > LIMITE) return { ...resumo, erro: `Máximo de ${LIMITE} linhas por importação.` };

    const supabase = await createClient();
    const org = ctx.orgId;

    // ---- empresas
    const { data: empresasDb, error: e1 } = await supabase.from("empresas").select("id, razao_social").eq("org_id", org);
    if (e1) throw e1;
    const empresaPorChave = new Map((empresasDb ?? []).map((e) => [chaveNome(e.razao_social), e.id as string]));
    const novasEmpresas = new Map<string, string>();
    for (const l of linhas) {
      const k = chaveNome(l.empresa);
      if (!empresaPorChave.has(k) && !novasEmpresas.has(k)) novasEmpresas.set(k, l.empresa);
    }
    if (novasEmpresas.size) {
      const { data, error } = await supabase
        .from("empresas")
        .insert([...novasEmpresas.values()].map((razao_social) => ({ org_id: org, razao_social })))
        .select("id, razao_social");
      if (error) throw error;
      for (const e of data ?? []) empresaPorChave.set(chaveNome(e.razao_social), e.id);
      resumo.empresasCriadas = data?.length ?? 0;
    }

    // ---- empreendimentos (únicos por empresa + nome)
    const { data: empsDb, error: e2 } = await supabase.from("empreendimentos").select("id, empresa_id, nome").eq("org_id", org);
    if (e2) throw e2;
    const chaveEmp = (empresaId: string, nome: string) => `${empresaId}|${chaveNome(nome)}`;
    const empPorChave = new Map((empsDb ?? []).map((e) => [chaveEmp(e.empresa_id, e.nome), e.id as string]));
    const novosEmps = new Map<string, { org_id: string; empresa_id: string; nome: string; municipio: string | null; uf: string | null }>();
    for (const l of linhas) {
      const empresaId = empresaPorChave.get(chaveNome(l.empresa))!;
      const k = chaveEmp(empresaId, l.empreendimento);
      if (!empPorChave.has(k) && !novosEmps.has(k)) {
        novosEmps.set(k, { org_id: org, empresa_id: empresaId, nome: l.empreendimento, municipio: l.municipio, uf: l.uf });
      }
    }
    if (novosEmps.size) {
      const { data, error } = await supabase.from("empreendimentos").insert([...novosEmps.values()]).select("id, empresa_id, nome");
      if (error) throw error;
      for (const e of data ?? []) empPorChave.set(chaveEmp(e.empresa_id, e.nome), e.id);
      resumo.empreendimentosCriados = data?.length ?? 0;
    }

    // ---- licenças
    const { data: licsDb, error: e3 } = await supabase
      .from("licencas")
      .select("id, empreendimento_id, tipo, numero, codigo_externo")
      .eq("org_id", org);
    if (e3) throw e3;
    const porCodigo = new Map<string, string>();
    const porIdentidade = new Map<string, string>();
    const identidade = (empId: string, tipo: string, numero: string | null) => `${empId}|${chaveNome(tipo)}|${chaveNome(numero ?? "")}`;
    for (const l of licsDb ?? []) {
      if (l.codigo_externo) porCodigo.set(l.codigo_externo, l.id);
      if (l.numero) porIdentidade.set(identidade(l.empreendimento_id, l.tipo, l.numero), l.id);
    }

    const corte = opcoes.encerrarVencidasHaMeses ? format(subMonths(new Date(`${hojeISO()}T12:00:00`), opcoes.encerrarVencidasHaMeses), "yyyy-MM-dd") : null;

    const inserir: Record<string, unknown>[] = [];
    const atualizar: { id: string; dados: Record<string, unknown> }[] = [];
    const vistos = new Set<string>();

    for (const l of linhas) {
      const empresaId = empresaPorChave.get(chaveNome(l.empresa))!;
      const empId = empPorChave.get(chaveEmp(empresaId, l.empreendimento))!;
      let situacao = l.situacao;
      if (corte && situacao === "ativa" && l.data_validade && l.data_validade < corte) {
        situacao = "encerrada";
        resumo.encerradas++;
      }
      const dados = {
        org_id: org,
        empreendimento_id: empId,
        tipo: l.tipo,
        numero: l.numero,
        processo: l.processo,
        orgao: l.orgao,
        descricao: l.descricao,
        data_emissao: l.data_emissao,
        data_validade: l.data_validade,
        antecedencia_renovacao_dias: l.antecedencia_renovacao_dias,
        situacao,
        observacoes: l.observacoes,
        codigo_externo: l.codigo_externo,
      };
      const existente =
        (l.codigo_externo && porCodigo.get(l.codigo_externo)) || (l.numero ? porIdentidade.get(identidade(empId, l.tipo, l.numero)) : undefined);
      const chaveLinha = existente ?? l.codigo_externo ?? identidade(empId, l.tipo, l.numero ?? `linha${l.linha}`);
      if (vistos.has(chaveLinha)) continue; // linha repetida na própria planilha
      vistos.add(chaveLinha);
      if (existente) atualizar.push({ id: existente, dados });
      else inserir.push(dados);
    }

    for (let i = 0; i < inserir.length; i += 500) {
      const { error } = await supabase.from("licencas").insert(inserir.slice(i, i + 500));
      if (error) throw error;
    }
    resumo.licencasCriadas = inserir.length;

    for (let i = 0; i < atualizar.length; i += 10) {
      const lote = atualizar.slice(i, i + 10);
      const res = await Promise.all(lote.map((u) => supabase.from("licencas").update(u.dados).eq("id", u.id)));
      const falha = res.find((r) => r.error);
      if (falha?.error) throw falha.error;
    }
    resumo.licencasAtualizadas = atualizar.length;

    revalidatePath("/", "layout");
    return { ...resumo, ok: true };
  } catch (e) {
    return { ...resumo, erro: (e as { message?: string }).message ?? String(e) };
  }
}
