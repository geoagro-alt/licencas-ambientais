/**
 * A API do Supabase (PostgREST) devolve no máximo 1.000 linhas por consulta.
 * `buscarTudo` percorre as páginas até o fim, para que listas grandes (licenças, histórico de alertas)
 * nunca sejam cortadas em silêncio.
 *
 * Uso — a consulta precisa ter uma ordenação estável (termine com `.order("id")`):
 *   const licencas = await buscarTudo((de, ate) =>
 *     supabase.from("licencas").select("*").eq("org_id", org).order("id").range(de, ate));
 */
export const TAMANHO_PAGINA = 1000;

interface Pagina<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function buscarTudo<T>(
  pagina: (de: number, ate: number) => PromiseLike<Pagina<T>>,
  tamanho = TAMANHO_PAGINA,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pagina(de, de + tamanho - 1);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    tudo.push(...linhas);
    if (linhas.length < tamanho) return tudo;
  }
}
