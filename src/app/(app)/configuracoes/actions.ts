"use server";

import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { enviarEmail } from "@/lib/email";
import { executarAlertas } from "@/lib/executar-alertas";
import { createClient } from "@/lib/supabase/server";

export type Estado = { ok?: string; erro?: string } | undefined;

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
      .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
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
    const papel = String(form.get("papel") ?? "editor") as "admin" | "editor" | "leitor";
    if (!email) return { erro: "Informe o e-mail." };
    const supabase = await createClient();
    const { error } = await supabase.from("convites").upsert({ org_id: ctx.orgId, email, papel }, { onConflict: "org_id,email" });
    if (error) return { erro: error.message };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    if (process.env.RESEND_API_KEY) {
      try {
        await enviarEmail(
          email,
          `Convite para acompanhar licenças — ${ctx.orgNome}`,
          `<p>Você foi convidado(a) para a organização <b>${ctx.orgNome}</b> no sistema de acompanhamento de licenças ambientais.</p>
           <p><a href="${appUrl}/login">Crie sua conta</a> usando este mesmo e-mail (${email}) para entrar automaticamente.</p>`,
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
  if (form.get("remover") === "1") {
    await supabase.from("membros").delete().eq("org_id", ctx.orgId).eq("user_id", userId);
  } else {
    await supabase
      .from("membros")
      .update({ papel: String(form.get("papel")) as "editor" })
      .eq("org_id", ctx.orgId)
      .eq("user_id", userId);
  }
  revalidatePath("/configuracoes");
}

export async function novaSenha(_: Estado, form: FormData): Promise<Estado> {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 6) return { erro: "A senha precisa ter pelo menos 6 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  return error ? { erro: error.message } : { ok: "Senha alterada." };
}
