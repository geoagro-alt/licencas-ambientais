"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { cadastrar, entrar, recuperarSenha, type EstadoLogin } from "./actions";

type Modo = "entrar" | "cadastrar" | "recuperar";

export function FormLogin({ next, erroInicial }: { next: string; erroInicial?: string }) {
  const [modo, setModo] = useState<Modo>("entrar");
  const acao = modo === "entrar" ? entrar : modo === "cadastrar" ? cadastrar : recuperarSenha;
  const [estado, formAction, pendente] = useActionState<EstadoLogin, FormData>(acao, erroInicial ? { erro: erroInicial } : undefined);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <form action={formAction} className="space-y-4" key={modo}>
        <input type="hidden" name="next" value={next} />
        {modo === "cadastrar" && (
          <>
            <Field label="Seu nome">
              <Input name="nome" required autoComplete="name" />
            </Field>
            <Field label="Nome da empresa / consultoria" dica="Cria a sua organização. Quem for convidado depois entra direto nela.">
              <Input name="organizacao" placeholder="Ex.: GeoAgro Consultoria" />
            </Field>
          </>
        )}
        <Field label="E-mail">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        {modo !== "recuperar" && (
          <Field label="Senha">
            <Input name="senha" type="password" required minLength={6} autoComplete={modo === "entrar" ? "current-password" : "new-password"} />
          </Field>
        )}

        {estado?.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>}
        {estado?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{estado.ok}</p>}

        <Button type="submit" disabled={pendente} className="w-full">
          {pendente ? "Aguarde…" : modo === "entrar" ? "Entrar" : modo === "cadastrar" ? "Criar conta" : "Enviar link"}
        </Button>
      </form>

      <div className="mt-5 flex justify-between text-sm">
        {modo !== "entrar" ? (
          <button className="text-emerald-700 hover:underline" onClick={() => setModo("entrar")}>Já tenho conta</button>
        ) : (
          <button className="text-emerald-700 hover:underline" onClick={() => setModo("cadastrar")}>Criar conta</button>
        )}
        {modo === "entrar" && (
          <button className="text-slate-500 hover:underline" onClick={() => setModo("recuperar")}>Esqueci a senha</button>
        )}
      </div>
    </div>
  );
}
