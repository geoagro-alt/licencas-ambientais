import "server-only";
import { createClient } from "./supabase/server";
import type { Condicionante, Licenca, Membro } from "./types";

export type LicencaCompleta = Licenca & {
  empreendimentos: { id: string; nome: string; municipio: string | null; uf: string | null; empresas: { id: string; razao_social: string } | null } | null;
};

export type CondicionanteCompleta = Condicionante & {
  licencas: (Pick<Licenca, "id" | "tipo" | "numero" | "situacao" | "responsavel_id"> & {
    empreendimentos: { nome: string; empresas: { razao_social: string } | null } | null;
  }) | null;
};

export const SELECT_LICENCA_COMPLETA = "*, empreendimentos(id, nome, municipio, uf, empresas(id, razao_social))";
export const SELECT_COND_COMPLETA = "*, licencas(id, tipo, numero, situacao, responsavel_id, empreendimentos(nome, empresas(razao_social)))";

export async function listarLicencas(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("licencas")
    .select(SELECT_LICENCA_COMPLETA)
    .eq("org_id", orgId)
    .order("data_validade", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as LicencaCompleta[];
}

export async function listarCondicionantes(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("condicionantes")
    .select(SELECT_COND_COMPLETA)
    .eq("org_id", orgId)
    .order("prazo", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as CondicionanteCompleta[];
}

export async function listarMembros(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("membros").select("*").eq("org_id", orgId).order("nome");
  return (data ?? []) as Membro[];
}

export async function listarEmpreendimentos(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("empreendimentos")
    .select("id, nome, municipio, uf, empresas(razao_social)")
    .eq("org_id", orgId)
    .order("nome");
  return (data ?? []) as unknown as { id: string; nome: string; municipio: string | null; uf: string | null; empresas: { razao_social: string } | null }[];
}

export function siglaTipo(tipo: string) {
  return tipo.split(" – ")[0];
}

export function nomeMembro(membros: Membro[], id: string | null) {
  if (!id) return "—";
  const m = membros.find((x) => x.user_id === id);
  return m?.nome || m?.email || "—";
}
