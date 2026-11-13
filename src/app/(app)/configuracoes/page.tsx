import { headers } from "next/headers";
import { Button, Card, Field, Input, PageHeader, Select, Tabela, Td, Th } from "@/components/ui";
import { BotaoConfirmar } from "@/components/confirmar";
import { getContexto } from "@/lib/contexto";
import { listarMembros } from "@/lib/dados";
import { createClient } from "@/lib/supabase/server";
import { alterarMembro, cancelarConvite, minhaPreferencia, salvarOrganizacao } from "./actions";
import { BotaoTeste, FormAlertas, FormConvite, FormSenha } from "./forms";

const PAPEIS = { admin: "Admin", editor: "Editor", leitor: "Leitor" };

export default async function ConfiguracoesPage() {
  const ctx = await getContexto();
  const supabase = await createClient();
  const admin = ctx.papel === "admin";

  const [{ data: cfg }, { data: org }, membros, { data: convites }, { data: enviados }] = await Promise.all([
    supabase.from("alertas_config").select("*").eq("org_id", ctx.orgId).maybeSingle(),
    supabase.from("organizacoes").select("nome, ics_token").eq("id", ctx.orgId).single(),
    listarMembros(ctx.orgId),
    admin ? supabase.from("convites").select("*").eq("org_id", ctx.orgId) : Promise.resolve({ data: [] as { id: string; email: string; papel: string }[] }),
    supabase.from("alertas_enviados").select("enviado_em, destinatarios").eq("org_id", ctx.orgId).order("enviado_em", { ascending: false }).limit(200),
  ]);
  const eu = membros.find((m) => m.user_id === ctx.userId);

  const h = await headers();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const icsUrl = `${base.replace(/\/$/, "")}/api/calendario/${org?.ics_token}.ics`;

  // agrupa o histórico por dia
  const porDia = new Map<string, Set<string>>();
  for (const e of enviados ?? []) {
    const d = new Date(e.enviado_em).toLocaleDateString("pt-BR");
    const s = porDia.get(d) ?? new Set<string>();
    (e.destinatarios as string[]).forEach((x) => s.add(x));
    porDia.set(d, s);
  }

  return (
    <>
      <PageHeader titulo="Configurações" subtitulo={`Você é ${PAPEIS[ctx.papel].toLowerCase()} de ${ctx.orgNome}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card titulo="Alertas por e-mail">
          <FormAlertas dias={cfg?.dias_antes ?? [120, 90, 60, 30, 15, 7, 1, 0]} emails={cfg?.emails_extras ?? []} ativo={cfg?.ativo ?? true} admin={admin} />
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm text-slate-600">
              Quem recebe: <b>admins</b> recebem tudo; <b>editores/leitores</b> recebem só o que estiver sob sua responsabilidade; e-mails adicionais recebem tudo.
            </p>
            <BotaoTeste />
          </div>
          {porDia.size > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Últimos envios</h3>
              <ul className="space-y-1 text-xs text-slate-600">
                {[...porDia].slice(0, 8).map(([d, s]) => (
                  <li key={d}>
                    <b>{d}</b> — {[...s].join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card titulo="Meu perfil">
            <form action={minhaPreferencia} className="space-y-3">
              <Field label="Nome">
                <Input name="nome" defaultValue={eu?.nome ?? ""} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="receber_alertas" defaultChecked={eu?.receber_alertas ?? true} className="h-4 w-4 rounded border-slate-300" />
                Quero receber alertas por e-mail ({ctx.email})
              </label>
              <Button type="submit" variante="secundario">
                Salvar
              </Button>
            </form>
            <div className="mt-6 border-t border-slate-100 pt-4">
              <FormSenha />
            </div>
          </Card>

          <Card titulo="Agenda (Google Agenda / Outlook / iPhone)">
            <p className="mb-2 text-sm text-slate-600">
              Assine este link para ver todos os prazos no seu calendário (atualiza sozinho). No Google Agenda: <i>Outras agendas → + → Do URL</i>.
            </p>
            <Input readOnly value={icsUrl} className="font-mono text-xs" />
            <p className="mt-2 text-xs text-slate-500">Quem tiver o link vê os prazos — não compartilhe publicamente.</p>
          </Card>

          {admin && (
            <Card titulo="Organização">
              <form action={salvarOrganizacao} className="flex gap-2">
                <Input name="nome" defaultValue={org?.nome ?? ""} required />
                <Button type="submit" variante="secundario">
                  Salvar
                </Button>
              </form>
            </Card>
          )}
        </div>

        <Card titulo={`Equipe (${membros.length})`} className="lg:col-span-2">
          <Tabela>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Alertas</Th>
                <Th>Papel</Th>
                {admin && <Th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {membros.map((m) => (
                <tr key={m.user_id}>
                  <Td>{m.nome ?? "—"}</Td>
                  <Td>{m.email}</Td>
                  <Td>{m.receber_alertas ? "Sim" : "Não"}</Td>
                  <Td>
                    {admin && m.user_id !== ctx.userId ? (
                      <form action={alterarMembro} className="flex gap-2">
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <Select name="papel" defaultValue={m.papel} className="max-w-32 py-1">
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="leitor">Leitor</option>
                        </Select>
                        <Button type="submit" variante="fantasma" className="py-1">
                          Salvar
                        </Button>
                      </form>
                    ) : (
                      PAPEIS[m.papel]
                    )}
                  </Td>
                  {admin && (
                    <Td className="text-right">
                      {m.user_id !== ctx.userId && (
                        <form action={alterarMembro}>
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <input type="hidden" name="remover" value="1" />
                          <BotaoConfirmar mensagem={`Remover ${m.email} da organização?`} className="text-xs text-red-600 hover:underline">
                            Remover
                          </BotaoConfirmar>
                        </form>
                      )}
                    </Td>
                  )}
                </tr>
              ))}
              {convites?.map((c) => (
                <tr key={c.id} className="text-slate-400">
                  <Td>convite pendente</Td>
                  <Td>{c.email}</Td>
                  <Td>—</Td>
                  <Td>{PAPEIS[c.papel as keyof typeof PAPEIS]}</Td>
                  <Td className="text-right">
                    <form action={cancelarConvite}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-xs hover:underline">Cancelar</button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          {admin && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-medium">Convidar pessoa</h3>
              <FormConvite />
              <p className="mt-2 text-xs text-slate-500">
                <b>Admin</b>: tudo, inclusive equipe e alertas · <b>Editor</b>: cadastra e edita licenças · <b>Leitor</b>: só visualiza.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
