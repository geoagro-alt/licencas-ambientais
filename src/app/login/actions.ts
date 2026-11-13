"use server";

import { redirect } from "next/navigation";
import { destinoSeguro, SENHA_MINIMA } from "@/lib/seguranca";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string; ok?: string } | undefined;

export async function entrar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("senha")),
  });
  if (error) return { erro: error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message };
  redirect(destinoSeguro(String(form.get("next") || "")));
}

export async function cadastrar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < SENHA_MINIMA) return { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get("email")),
    password: senha,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
      data: { nome: String(form.get("nome") || ""), organizacao: String(form.get("organizacao") || "") },
    },
  });
  if (error) {
    // o gatilho handle_new_user recusa e-mails sem convite (ver supabase/migrations/0006)
    if (/database error|convite/i.test(error.message)) {
      return { erro: "O cadastro é apenas por convite. Peça ao administrador da sua organização para convidar este e-mail." };
    }
    return { erro: error.message };
  }
  if (data.session) redirect("/dashboard");
  return { ok: "Conta criada! Confira seu e-mail para confirmar o cadastro e depois faça login." };
}

export async function recuperarSenha(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(String(form.get("email")), {
    redirectTo: `${appUrl}/auth/callback?next=/configuracoes`,
  });
  if (error) return { erro: error.message };
  return { ok: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
