import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarTudo } from "./paginacao";

const LOTE = 100;

/**
 * Caminhos (no Storage) de todos os documentos ligados às licenças informadas.
 * Chame ANTES de excluir do banco (o `on delete cascade` apaga as linhas de `documentos`)
 * e passe o resultado a `removerArquivos` DEPOIS que a exclusão der certo.
 */
export async function caminhosDeLicencas(supabase: SupabaseClient, licencaIds: string[]): Promise<string[]> {
  const caminhos: string[] = [];
  for (let i = 0; i < licencaIds.length; i += LOTE) {
    const lote = licencaIds.slice(i, i + LOTE);
    const docs = await buscarTudo((de, ate) => supabase.from("documentos").select("storage_path").in("licenca_id", lote).order("id").range(de, ate));
    caminhos.push(...docs.map((d) => d.storage_path as string));
  }
  return caminhos;
}

export async function caminhosDeEmpreendimentos(supabase: SupabaseClient, empreendimentoIds: string[]): Promise<string[]> {
  const licencaIds: string[] = [];
  for (let i = 0; i < empreendimentoIds.length; i += LOTE) {
    const lote = empreendimentoIds.slice(i, i + LOTE);
    const lics = await buscarTudo((de, ate) => supabase.from("licencas").select("id").in("empreendimento_id", lote).order("id").range(de, ate));
    licencaIds.push(...lics.map((l) => l.id as string));
  }
  return caminhosDeLicencas(supabase, licencaIds);
}

export async function caminhosDeEmpresa(supabase: SupabaseClient, empresaId: string): Promise<string[]> {
  const emps = await buscarTudo((de, ate) => supabase.from("empreendimentos").select("id").eq("empresa_id", empresaId).order("id").range(de, ate));
  return caminhosDeEmpreendimentos(supabase, emps.map((e) => e.id as string));
}

/** Remove arquivos do bucket "documentos". Falha aqui não desfaz a exclusão já feita no banco. */
export async function removerArquivos(supabase: SupabaseClient, caminhos: string[]) {
  for (let i = 0; i < caminhos.length; i += LOTE) {
    await supabase.storage.from("documentos").remove(caminhos.slice(i, i + LOTE));
  }
}
