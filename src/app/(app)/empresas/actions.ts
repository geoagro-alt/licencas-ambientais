"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
    revalidatePath(`/empresas/${id}`);
  } else {
    const { data, error } = await supabase.from("empresas").insert(dados).select("id").single();
    if (error) throw new Error(error.message);
    redirect(`/empresas/${data.id}`);
  }
  revalidatePath("/empresas");
}

export async function excluirEmpresa(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("empresas").delete().eq("id", String(form.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/empresas");
  redirect("/empresas");
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
  revalidatePath(`/empresas/${empresaId}`);
}

export async function excluirEmpreendimento(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("empreendimentos").delete().eq("id", String(form.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${String(form.get("empresa_id"))}`);
}
