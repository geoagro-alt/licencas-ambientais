"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { enviarEmail } from "@/lib/email";
import { executarAlertas } from "@/lib/executar-alertas";
import { EMAIL_VALIDO, escHtml, SENHA_MINIMA } from "@/lib/seguranca";
import { createClient } from "@/lib/supabase/server";
import type { Papel } from "@/lib/types";

export type Estado = { ok?: string; erro?: string } | undefined;

const MAX_CONVITES_PENDENTES = 50;
const ehPapel = (p: string): p is Papel => p === "admin" || p === "editor" || p === "leitor";

async function exigirAdmin() {
  const ctx = await getContexto();
  if (ctx.papel !== "admin") throw new Error("Apenas administradores podem alterar esta configuração.");
  return ctx;
}

export async function salvarOrganizacao(form: FormData) {
  const ctx = await exigirAdmin();
  const supabase = await createClient();
  await supabase.from("organizacoes").update({ nome: String(form.get("nome")).trim() }).eq("id", ctx.orgId);
  revalidatePath("/", "layout");
}

export async function salvarAlertas(_: Estado, form: FormData): Promise<Estado> {
  try {
    const ctx = await exigirAdmin();
    const dias = String(form.get("dias_antes") ?? "")
      .split(/[,;\s]+/)
      .map((x) => parseInt(x, 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 730);
    const emails = String(form.get("emails_extras") ?? "")
      .split(/[,;\s]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => EMAIL_VALIDO.test(x))
      .slice(0, 20);
    const supabase = await createClient();
    const { error } = await supabase
      .from("alertas_config")
      .update({
        dias_antes: [...new Set(dias)].sort((a, b) => b - a),
        emails_extras: [...new Set(emails)],
        ativo: form.get("ativo") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", ctx.orgId);
    if (error) return { erro: error.message };
    revalidatePath("/configuracoes");
    return { ok: "Configuração de alertas salva." };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

export async function minhaPreferencia(form: FormData) {
  const ctx = await getContexto();
  const supabase = await createClient();
  await supabase
    .from("membros")
    .update({ receber_alertas: form.get("receber_alertas") === "on", nome: String(form.get("nome") ?? "").trim() || null })
    .eq("org_id", ctx.orgId)
    .eq("user_id", ctx.userId);
  revalidatePath("/configuracoes");
}

/** Envia para o próprio usuário um resumo com TODOS os prazos atualmente na janela de aviso (ignora histórico). */
export async function testarAlerta(): Promise<Estado> {
  try {
    const ctx = await getContexto();
    if (!process.env.RESEND_API_KEY) return { erro: "Configure RESEND_API_KEY nas variáveis de ambiente." };
    const [r] = await executarAlertas({ orgId: ctx.orgId, ignorarHistorico: true, somentePara: ctx.email });
    if (!r || r.itens === 0) {
      await enviarEmail(
        ctx.email,
        "[Licenças] Teste de alerta",
        "<p>Os alertas por e-mail estão funcionando. No momento não há prazos dentro da janela de aviso.</p>",
        "Os alertas por e-mail estão funcionando. No momento não há prazos dentro da janela de aviso.",
      );
      return { ok: `E-mail de teste enviado para ${ctx.email} (sem prazos na janela de aviso agora).` };
    }
    const falha = r.emails.find((e) => !e.ok);
    if (falha) return { erro: falha.erro };
    return { ok: `Enviado para ${ctx.email} com ${r.itens} prazo(s).` };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

export async function convidar(_: Estado, form: FormData): Promise<Estado> {
  try {
    const ctx = await exigirAdmin();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const papel = String(form.get("papel") ?? "editor");
    if (!EMAIL_VALIDO.test(email)) return { erro: "Informe um e-mail válido." };
    if (!ehPapel(papel)) return { erro: "Papel inválido." };
    const supabase = await createClient();
    // freio contra uso do convite para disparar e-mails em massa
    const { count } = await supabase.from("convites").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId);
    if ((count ?? 0) >= MAX_CONVITES_PENDENTES) {
      return { erro: `Há ${count} convites pendentes. Cancele os que não forem mais necessários antes de convidar outras pessoas.` };
    }
    const { error } = await supabase.from("convites").upsert({ org_id: ctx.orgId, email, papel }, { onConflict: "org_id,email" });
    if (error) return { erro: error.message };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (process.env.RESEND_API_KEY) {
      try {
        await enviarEmail(
          email,
          `Convite para acompanhar licenças — ${ctx.orgNome}`,
          // nome da organização e e-mail são digitados por usuários: sempre escapar no HTML
          `<p>Você foi convidado(a) para a organização <b>${escHtml(ctx.orgNome)}</b> no sistema de acompanhamento de licenças ambientais.</p>
           <p><a href="${appUrl}/login">Crie sua conta</a> (ou entre, se já tiver uma) usando este mesmo e-mail (${escHtml(email)}) para entrar automaticamente.</p>`,
          `Você foi convidado(a) para ${ctx.orgNome}. Crie sua conta em ${appUrl}/login usando o e-mail ${email}.`,
        );
      } catch {
        /* convite salvo mesmo se o e-mail falhar */
      }
    }
    revalidatePath("/configuracoes");
    return { ok: `Convite registrado. Peça para ${email} criar a conta em ${appUrl}/login com esse e-mail.` };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

export async function cancelarConvite(form: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  await supabase.from("convites").delete().eq("id", String(form.get("id")));
  revalidatePath("/configuracoes");
}

export async function alterarMembro(form: FormData) {
  const ctx = await exigirAdmin();
  const supabase = await createClient();
  const userId = String(form.get("user_id"));
  // ninguém altera ou remove a si mesmo: evita organização sem admin (o banco também recusa)
  if (userId === ctx.userId) throw new Error("Você não pode alterar o seu próprio acesso.");
  if (form.get("remover") === "1") {
    const { error } = await supabase.from("membros").delete().eq("org_id", ctx.orgId).eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const papel = String(form.get("papel"));
    if (!ehPapel(papel)) throw new Error("Papel inválido.");
    const { error } = await supabase.from("membros").update({ papel }).eq("org_id", ctx.orgId).eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/configuracoes");
}

/** Troca o endereço secreto da agenda (.ics). O link antigo para de funcionar na hora. */
export async function regenerarTokenAgenda() {
  const ctx = await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizacoes")
    .update({ ics_token: randomBytes(18).toString("hex") })
    .eq("id", ctx.orgId);
  if (error) throw new Error(error.message);
  revalidatePath("/configuracoes");
}

export async function novaSenha(_: Estado, form: FormData): Promise<Estado> {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < SENHA_MINIMA) return { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  return error ? { erro: error.message } : { ok: "Senha alterada." };
}
