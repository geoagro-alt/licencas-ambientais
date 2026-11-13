"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { caminhosDeEmpreendimentos, caminhosDeEmpresa, removerArquivos } from "@/lib/arquivos";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";

const txt = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const num = (f: FormData, k: string) => {
  const v = txt(f, k);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export async function salvarEmpresa(form: FormData) {
  const ctx = await getContexto();
  const supabase = await createClient();
  const id = txt(form, "id");
  const dados = {
    org_id: ctx.orgId,
    razao_social: txt(form, "razao_social") ?? "Sem nome",
    cnpj_cpf: txt(form, "cnpj_cpf"),
    contato_nome: txt(form, "contato_nome"),
    contato_email: txt(form, "contato_email"),
    telefone: txt(form, "telefone"),
    observacoes: txt(form, "observacoes"),
  };
  if (id) {
    const { error } = await supabase.from("empresas").update(dados).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/clientes/${id}`);
  } else {
    const { data, error } = await supabase.from("empresas").insert(dados).select("id").single();
    if (error) throw new Error(error.message);
    redirect(`/clientes/${data.id}`);
  }
  revalidatePath("/clientes");
}

export async function excluirEmpresa(form: FormData) {
  const supabase = await createClient();
  const id = String(form.get("id"));
  // o cascade apaga licenças e registros de documentos; os arquivos no Storage precisam sair à parte
  const caminhos = await caminhosDeEmpresa(supabase, id);
  const { error } = await supabase.from("empresas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await removerArquivos(supabase, caminhos);
  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function salvarEmpreendimento(form: FormData) {
  const ctx = await getContexto();
  const supabase = await createClient();
  const id = txt(form, "id");
  const empresaId = String(form.get("empresa_id"));
  const dados = {
    org_id: ctx.orgId,
    empresa_id: empresaId,
    nome: txt(form, "nome") ?? "Sem nome",
    atividade: txt(form, "atividade"),
    municipio: txt(form, "municipio"),
    uf: txt(form, "uf"),
    car: txt(form, "car"),
    latitude: num(form, "latitude"),
    longitude: num(form, "longitude"),
    observacoes: txt(form, "observacoes"),
  };
  const { error } = id
    ? await supabase.from("empreendimentos").update(dados).eq("id", id)
    : await supabase.from("empreendimentos").insert(dados);
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${empresaId}`);
}

export async function excluirEmpreendimento(form: FormData) {
  const supabase = await createClient();
  const id = String(form.get("id"));
  const caminhos = await caminhosDeEmpreendimentos(supabase, [id]);
  const { error } = await supabase.from("empreendimentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await removerArquivos(supabase, caminhos);
  revalidatePath(`/clientes/${String(form.get("empresa_id"))}`);
}
