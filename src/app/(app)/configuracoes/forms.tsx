"use client";

import { useActionState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { convidar, novaSenha, salvarAlertas, testarAlerta, type Estado } from "./actions";

function Msg({ e }: { e: Estado }) {
  if (!e) return null;
  return e.erro ? (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{e.erro}</p>
  ) : (
    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{e.ok}</p>
  );
}

export function FormAlertas({ dias, emails, ativo, admin }: { dias: number[]; emails: string[]; ativo: boolean; admin: boolean }) {
  const [estado, action, pend] = useActionState(salvarAlertas, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="ativo" defaultChecked={ativo} disabled={!admin} className="h-4 w-4 rounded border-slate-300 text-emerald-700" />
        Enviar alertas diários por e-mail (todo dia às 7h)
      </label>
      <Field label="Avisar com quantos dias de antecedência" dica="Separe por vírgula. 0 = no dia. Itens vencidos são lembrados uma vez por semana.">
        <Input name="dias_antes" defaultValue={dias.join(", ")} disabled={!admin} />
      </Field>
      <Field label="E-mails adicionais (recebem todos os alertas)" dica="Ex.: e-mail do cliente, do gerente da fazenda, caixa compartilhada. Separe por vírgula.">
        <Textarea name="emails_extras" defaultValue={emails.join(", ")} disabled={!admin} rows={2} />
      </Field>
      <Msg e={estado} />
      {admin && (
        <Button type="submit" disabled={pend}>
          {pend ? "Salvando…" : "Salvar"}
        </Button>
      )}
    </form>
  );
}

export function BotaoTeste() {
  const [estado, action, pend] = useActionState(testarAlerta, undefined);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variante="secundario" disabled={pend}>
        {pend ? "Enviando…" : "Enviar e-mail de teste para mim"}
      </Button>
      <Msg e={estado} />
    </form>
  );
}

export function FormConvite() {
  const [estado, action, pend] = useActionState(convidar, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input name="email" type="email" required placeholder="email@empresa.com" className="max-w-xs flex-1" />
        <Select name="papel" defaultValue="editor" className="max-w-36">
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="leitor">Leitor</option>
        </Select>
        <Button type="submit" disabled={pend}>
          Convidar
        </Button>
      </div>
      <Msg e={estado} />
    </form>
  );
}

export function FormSenha() {
  const [estado, action, pend] = useActionState(novaSenha, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Nova senha">
        <Input name="senha" type="password" minLength={6} required autoComplete="new-password" />
      </Field>
      <Msg e={estado} />
      <Button type="submit" variante="secundario" disabled={pend}>
        Alterar senha
      </Button>
    </form>
  );
}
