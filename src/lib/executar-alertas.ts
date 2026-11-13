import "server-only";
import { createAdminClient } from "./supabase/admin";
import {
  chaveAlerta,
  distribuir,
  itensDeCondicionantes,
  itensDeLicencas,
  selecionarAlertas,
  type LinhaCondicionante,
  type LinhaLicenca,
  type MembroAlerta,
} from "./alertas";
import { enviarEmail, montarEmailAlertas } from "./email";
import { hojeISO } from "./prazos";

const SELECT_LICENCA =
  "id, tipo, numero, data_validade, antecedencia_renovacao_dias, situacao, protocolo_renovacao, responsavel_id, empreendimentos(nome, empresas(razao_social))";

export interface Opcoes {
  orgId?: string;            // limitar a uma organização
  dryRun?: boolean;          // não envia nem registra
  ignorarHistorico?: boolean; // e-mail de teste: ignora o que já foi avisado
  somentePara?: string;      // e-mail de teste: manda só para este endereço
}

export interface ResultadoOrg {
  orgId: string;
  orgNome: string;
  itens: number;
  emails: { para: string; itens: number; ok: boolean; erro?: string }[];
}

export async function executarAlertas(opts: Opcoes = {}): Promise<ResultadoOrg[]> {
  const db = createAdminClient();
  const hoje = hojeISO();

  let q = db.from("alertas_config").select("org_id, dias_antes, emails_extras, ativo, organizacoes(nome)");
  if (opts.orgId) q = q.eq("org_id", opts.orgId);
  else q = q.eq("ativo", true);
  const { data: configs, error } = await q;
  if (error) throw error;

  const resultados: ResultadoOrg[] = [];

  for (const cfg of configs ?? []) {
    const orgId = cfg.org_id as string;
    const orgNome = (cfg.organizacoes as unknown as { nome: string } | null)?.nome ?? "Organização";

    const [{ data: licencas }, { data: conds }, { data: membros }, { data: enviados }] = await Promise.all([
      db.from("licencas").select(SELECT_LICENCA).eq("org_id", orgId),
      db
        .from("condicionantes")
        .select(`id, licenca_id, numero, descricao, prazo, situacao, responsavel_id, licencas(${SELECT_LICENCA})`)
        .eq("org_id", orgId)
        .in("situacao", ["pendente", "em_andamento"])
        .not("prazo", "is", null),
      db.from("membros").select("user_id, email, papel, receber_alertas").eq("org_id", orgId),
      opts.ignorarHistorico
        ? Promise.resolve({ data: [] as { entidade: string; entidade_id: string; data_referencia: string; marco_dias: number }[] })
        : db.from("alertas_enviados").select("entidade, entidade_id, data_referencia, marco_dias").eq("org_id", orgId),
    ]);

    const itens = [
      ...itensDeLicencas((licencas ?? []) as unknown as LinhaLicenca[], hoje),
      ...itensDeCondicionantes((conds ?? []) as unknown as LinhaCondicionante[]),
    ];
    const ja = new Set((enviados ?? []).map((e) => chaveAlerta(e.entidade, e.entidade_id, e.data_referencia, e.marco_dias)));
    const selecionados = selecionarAlertas(itens, cfg.dias_antes as number[], ja, hoje);

    const resultado: ResultadoOrg = { orgId, orgNome, itens: selecionados.length, emails: [] };
    resultados.push(resultado);
    if (selecionados.length === 0) continue;

    const distrib = opts.somentePara
      ? new Map([[opts.somentePara, selecionados]])
      : distribuir(selecionados, (membros ?? []) as MembroAlerta[], (cfg.emails_extras as string[]) ?? []);

    const avisados = new Map<string, string[]>(); // chave -> destinatários com sucesso
    for (const [para, lista] of distrib) {
      if (opts.dryRun) {
        resultado.emails.push({ para, itens: lista.length, ok: true });
        continue;
      }
      try {
        const { assunto, html, texto } = montarEmailAlertas(orgNome, lista);
        await enviarEmail(para, assunto, html, texto);
        resultado.emails.push({ para, itens: lista.length, ok: true });
        for (const i of lista) {
          const k = chaveAlerta(i.entidade, i.id, i.dataReferencia, i.marco);
          avisados.set(k, [...(avisados.get(k) ?? []), para]);
        }
      } catch (e) {
        resultado.emails.push({ para, itens: lista.length, ok: false, erro: (e as Error).message });
      }
    }

    if (!opts.dryRun && !opts.ignorarHistorico && avisados.size > 0) {
      const linhas = selecionados
        .filter((i) => avisados.has(chaveAlerta(i.entidade, i.id, i.dataReferencia, i.marco)))
        .map((i) => ({
          org_id: orgId,
          entidade: i.entidade,
          entidade_id: i.id,
          data_referencia: i.dataReferencia,
          marco_dias: i.marco,
          destinatarios: avisados.get(chaveAlerta(i.entidade, i.id, i.dataReferencia, i.marco)) ?? [],
        }));
      await db.from("alertas_enviados").upsert(linhas, {
        onConflict: "entidade,entidade_id,data_referencia,marco_dias",
        ignoreDuplicates: true,
      });
    }
  }

  return resultados;
}
