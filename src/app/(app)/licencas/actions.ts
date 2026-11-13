"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { avancarPrazo, hojeISO } from "@/lib/prazos";
import { createClient } from "@/lib/supabase/server";

const txt = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const int = (f: FormData, k: string) => {
  const v = txt(f, k);
  return v === null ? null : parseInt(v, 10);
};

function revalidarTudo(licencaId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/licencas");
  revalidatePath("/condicionantes");
  revalidatePath("/calendario");
  if (licencaId) revalidatePath(`/licencas/${licencaId}`);
}

// ---------------------------------------------------------------- Licenças

export async function salvarLicenca(form: FormData) {
  const ctx = await getContexto();
  const supabase = await createClient();
  const id = txt(form, "id");
  const dados = {
    org_id: ctx.orgId,
    empreendimento_id: String(form.get("empreendimento_id")),
    tipo: txt(form, "tipo") ?? "Outro",
    numero: txt(form, "numero"),
    orgao: txt(form, "orgao"),
    processo: txt(form, "processo"),
    descricao: txt(form, "descricao"),
    data_emissao: txt(form, "data_emissao"),
    data_validade: txt(form, "data_validade"),
    antecedencia_renovacao_dias: int(form, "antecedencia_renovacao_dias") ?? 120,
    situacao: (txt(form, "situacao") ?? "ativa") as "ativa" | "em_renovacao" | "encerrada",
    protocolo_renovacao: txt(form, "protocolo_renovacao"),
    data_protocolo_renovacao: txt(form, "data_protocolo_renovacao"),
    responsavel_id: txt(form, "responsavel_id"),
    observacoes: txt(form, "observacoes"),
  };

  let licencaId = id;
  if (id) {
    const { error } = await supabase.from("licencas").update(dados).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("licencas").insert(dados).select("id").single();
    if (error) throw new Error(error.message);
    licencaId = data.id;
  }
  revalidarTudo(licencaId!);
  redirect(`/licencas/${licencaId}`);
}

export async function excluirLicenca(form: FormData) {
  const supabase = await createClient();
  const id = String(form.get("id"));
  const { data: docs } = await supabase.from("documentos").select("storage_path").eq("licenca_id", id);
  if (docs?.length) await supabase.storage.from("documentos").remove(docs.map((d) => d.storage_path));
  const { error } = await supabase.from("licencas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarTudo();
  redirect("/licencas");
}

/** Marca a licença como "em renovação" com o protocolo do requerimento. */
export async function registrarRenovacao(form: FormData) {
  const supabase = await createClient();
  const id = String(form.get("id"));
  const { error } = await supabase
    .from("licencas")
    .update({
      situacao: "em_renovacao",
      protocolo_renovacao: txt(form, "protocolo_renovacao"),
      data_protocolo_renovacao: txt(form, "data_protocolo_renovacao") ?? hojeISO(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidarTudo(id);
}

// ---------------------------------------------------------------- Condicionantes

export async function salvarCondicionante(form: FormData) {
  const ctx = await getContexto();
  const supabase = await createClient();
  const id = txt(form, "id");
  const licencaId = String(form.get("licenca_id"));
  const tipo = (txt(form, "tipo") ?? "unica") as "unica" | "periodica" | "permanente";
  const dados = {
    org_id: ctx.orgId,
    licenca_id: licencaId,
    numero: txt(form, "numero"),
    descricao: txt(form, "descricao") ?? "",
    tipo,
    periodicidade_meses: tipo === "periodica" ? int(form, "periodicidade_meses") ?? 12 : null,
    prazo: txt(form, "prazo"),
    responsavel_id: txt(form, "responsavel_id"),
    observacoes: txt(form, "observacoes"),
    ...(txt(form, "situacao") ? { situacao: txt(form, "situacao") as "pendente" } : {}),
  };
  const { error } = id
    ? await supabase.from("condicionantes").update(dados).eq("id", id)
    : await supabase.from("condicionantes").insert(dados);
  if (error) throw new Error(error.message);
  revalidarTudo(licencaId);
}

/** Cadastro em lote: uma condicionante por linha (copiar/colar do PDF da licença). */
export async function importarCondicionantes(form: FormData) {
  const ctx = await getContexto();
  const supabase = await createClient();
  const licencaId = String(form.get("licenca_id"));
  const prazo = txt(form, "prazo");
  const linhas = String(form.get("texto") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const registros = linhas.map((l) => {
    const m = l.match(/^(\d+(?:\.\d+)*)[\s.)\-–—:]+(.+)$/);
    return {
      org_id: ctx.orgId,
      licenca_id: licencaId,
      numero: m ? m[1] : null,
      descricao: m ? m[2] : l,
      tipo: "unica" as const,
      prazo,
    };
  });
  if (registros.length) {
    const { error } = await supabase.from("condicionantes").insert(registros);
    if (error) throw new Error(error.message);
  }
  revalidarTudo(licencaId);
}

export async function excluirCondicionante(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("condicionantes").delete().eq("id", String(form.get("id")));
  if (error) throw new Error(error.message);
  revalidarTudo(String(form.get("licenca_id")));
}

export async function mudarSituacaoCondicionante(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("condicionantes")
    .update({ situacao: String(form.get("situacao")) as "pendente" })
    .eq("id", String(form.get("id")));
  if (error) throw new Error(error.message);
  revalidarTudo(String(form.get("licenca_id") ?? ""));
}

/**
 * Registra o cumprimento/entrega. Periódicas: avança o prazo pela periodicidade e continuam pendentes.
 * Únicas: ficam "cumpridas". Retorna o id do cumprimento (para anexar comprovantes).
 */
export async function cumprirCondicionante(form: FormData) {
  const ctx = await getContexto();
  const supabase = await createClient();
  const id = String(form.get("id"));
  const { data: c, error: e1 } = await supabase
    .from("condicionantes")
    .select("id, licenca_id, tipo, prazo, periodicidade_meses")
    .eq("id", id)
    .single();
  if (e1 || !c) throw new Error(e1?.message ?? "Condicionante não encontrada");

  const { error: e2 } = await supabase.from("cumprimentos").insert({
    org_id: ctx.orgId,
    condicionante_id: id,
    prazo_referente: c.prazo,
    data_cumprimento: txt(form, "data_cumprimento") ?? hojeISO(),
    protocolo: txt(form, "protocolo"),
    observacao: txt(form, "observacao"),
    user_id: ctx.userId,
  });
  if (e2) throw new Error(e2.message);

  const update =
    c.tipo === "periodica" && c.prazo && c.periodicidade_meses
      ? { prazo: avancarPrazo(c.prazo, c.periodicidade_meses), situacao: "pendente" as const }
      : c.tipo === "permanente"
        ? { situacao: "pendente" as const }
        : { situacao: "cumprida" as const };
  const { error: e3 } = await supabase.from("condicionantes").update(update).eq("id", id);
  if (e3) throw new Error(e3.message);

  revalidarTudo(c.licenca_id);
}

// ---------------------------------------------------------------- Documentos

/** Chamado pelo navegador depois de subir o arquivo direto para o Storage. */
export async function registrarDocumento(dados: {
  licenca_id: string;
  condicionante_id?: string | null;
  nome: string;
  storage_path: string;
  tamanho_bytes: number;
  mime_type: string;
}) {
  const ctx = await getContexto();
  if (!dados.storage_path.startsWith(`${ctx.orgId}/`)) throw new Error("Caminho inválido");
  const supabase = await createClient();
  const { error } = await supabase.from("documentos").insert({
    ...dados,
    condicionante_id: dados.condicionante_id || null,
    org_id: ctx.orgId,
    user_id: ctx.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/licencas/${dados.licenca_id}`);
}

export async function excluirDocumento(form: FormData) {
  const supabase = await createClient();
  const id = String(form.get("id"));
  const { data: doc } = await supabase.from("documentos").select("storage_path, licenca_id").eq("id", id).single();
  if (doc) {
    await supabase.storage.from("documentos").remove([doc.storage_path]);
    await supabase.from("documentos").delete().eq("id", id);
    revalidatePath(`/licencas/${doc.licenca_id}`);
  }
}
