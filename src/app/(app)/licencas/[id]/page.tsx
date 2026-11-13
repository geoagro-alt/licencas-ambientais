import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { BotaoConfirmar } from "@/components/confirmar";
import { Badge, Button, Card, Field, Input, LinkButton, PageHeader, Select, Tabela, Td, Textarea, Th, Vazio } from "@/components/ui";
import { UploadDocumento } from "@/components/upload-documento";
import { getContexto } from "@/lib/contexto";
import { listarMembros, nomeMembro, SELECT_LICENCA_COMPLETA, siglaTipo, type LicencaCompleta } from "@/lib/dados";
import { fmtData, fmtDias, hojeISO, limiteRenovacao, statusCondicionante, statusLicenca } from "@/lib/prazos";
import { createClient } from "@/lib/supabase/server";
import type { Condicionante } from "@/lib/types";
import {
  cumprirCondicionante,
  excluirCondicionante,
  excluirDocumento,
  excluirLicenca,
  importarCondicionantes,
  mudarSituacaoCondicionante,
  registrarRenovacao,
  salvarCondicionante,
} from "../actions";

const ROTULO_TIPO = { unica: "Única", periodica: "Periódica", permanente: "Permanente" };

export default async function LicencaPage({ params }: PageProps<"/licencas/[id]">) {
  const { id } = await params;
  const ctx = await getContexto();
  const supabase = await createClient();

  const { data } = await supabase.from("licencas").select(SELECT_LICENCA_COMPLETA).eq("id", id).maybeSingle();
  if (!data) notFound();
  const l = data as unknown as LicencaCompleta;

  const [{ data: condsData }, { data: docs }, { data: cumprimentos }, { data: alertas }, membros] = await Promise.all([
    supabase.from("condicionantes").select("*").eq("licenca_id", id).order("numero", { nullsFirst: false }).order("created_at"),
    supabase.from("documentos").select("*").eq("licenca_id", id).order("created_at", { ascending: false }),
    supabase
      .from("cumprimentos")
      .select("*, condicionantes!inner(licenca_id, numero, descricao)")
      .eq("condicionantes.licenca_id", id)
      .order("data_cumprimento", { ascending: false })
      .limit(50),
    supabase.from("alertas_enviados").select("*").eq("entidade_id", id).order("enviado_em", { ascending: false }).limit(10),
    listarMembros(ctx.orgId),
  ]);
  const conds = (condsData ?? []) as Condicionante[];
  const s = statusLicenca(l);
  const limite = limiteRenovacao(l);
  const pendentes = conds.filter((c) => c.situacao === "pendente" || c.situacao === "em_andamento").length;

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link href="/licencas" className="hover:text-slate-800">
          Licenças
        </Link>{" "}
        /{" "}
        <Link href={`/clientes/${l.empreendimentos?.empresas?.id}`} className="hover:text-slate-800">
          {l.empreendimentos?.empresas?.razao_social}
        </Link>
      </div>
      <PageHeader
        titulo={`${siglaTipo(l.tipo)}${l.numero ? ` nº ${l.numero}` : ""}`}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <Badge nivel={s.nivel}>{s.rotulo}</Badge>
            <span>
              {l.empreendimentos?.nome}
              {l.empreendimentos?.municipio && ` · ${l.empreendimentos.municipio}/${l.empreendimentos.uf ?? ""}`}
              {l.orgao && ` · ${l.orgao}`}
            </span>
          </span>
        }
        acoes={
          ctx.podeEditar && (
            <>
              <LinkButton href={`/licencas/${id}/editar`} variante="secundario">
                <Pencil className="h-4 w-4" /> Editar
              </LinkButton>
              <form action={excluirLicenca}>
                <input type="hidden" name="id" value={id} />
                <BotaoConfirmar
                  mensagem="Excluir esta licença, suas condicionantes e documentos? Esta ação não pode ser desfeita."
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </BotaoConfirmar>
              </form>
            </>
          )
        }
      />

      {/* Resumo de prazos */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Resumo rotulo="Validade" valor={fmtData(l.data_validade)} extra={s.dias !== null ? fmtDias(s.dias) : "sem vencimento"} />
        <Resumo
          rotulo="Protocolar renovação até"
          valor={l.situacao === "ativa" ? fmtData(limite) : "—"}
          extra={
            l.protocolo_renovacao
              ? `Protocolo ${l.protocolo_renovacao} em ${fmtData(l.data_protocolo_renovacao)}`
              : `${l.antecedencia_renovacao_dias} dias antes do vencimento`
          }
        />
        <Resumo rotulo="Condicionantes pendentes" valor={String(pendentes)} extra={`${conds.length} no total`} />
        <Resumo rotulo="Responsável" valor={nomeMembro(membros, l.responsavel_id)} extra={l.processo ? `Processo ${l.processo}` : "—"} />
      </div>

      {ctx.podeEditar && l.situacao === "ativa" && l.data_validade && (
        <details className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 px-5 py-3">
          <summary className="cursor-pointer text-sm font-medium text-emerald-800">Registrar protocolo de renovação</summary>
          <form action={registrarRenovacao} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <Field label="Nº do protocolo">
              <Input name="protocolo_renovacao" required />
            </Field>
            <Field label="Data">
              <Input type="date" name="data_protocolo_renovacao" defaultValue={hojeISO()} />
            </Field>
            <Button type="submit">Marcar como em renovação</Button>
          </form>
        </details>
      )}

      {(l.descricao || l.observacoes) && (
        <Card className="mb-6">
          {l.descricao && <p className="whitespace-pre-line text-sm text-slate-700">{l.descricao}</p>}
          {l.observacoes && <p className="mt-2 whitespace-pre-line text-sm text-slate-500">{l.observacoes}</p>}
        </Card>
      )}

      {/* Condicionantes */}
      <Card titulo={`Condicionantes (${conds.length})`} className="mb-6">
        {conds.length === 0 ? (
          <Vazio>Nenhuma condicionante cadastrada.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th className="w-12">Nº</Th>
                <Th>Descrição</Th>
                <Th>Tipo</Th>
                <Th>Prazo</Th>
                <Th>Responsável</Th>
                <Th>Situação</Th>
                {ctx.podeEditar && <Th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conds.map((c) => {
                const sc = statusCondicionante(c);
                return (
                  <tr key={c.id}>
                    <Td className="font-medium">{c.numero ?? "—"}</Td>
                    <Td className="max-w-md">
                      <p className="whitespace-pre-line">{c.descricao}</p>
                      {c.observacoes && <p className="mt-1 text-xs text-slate-500">{c.observacoes}</p>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {ROTULO_TIPO[c.tipo]}
                      {c.tipo === "periodica" && c.periodicidade_meses && <div className="text-xs text-slate-500">a cada {c.periodicidade_meses} mês(es)</div>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {fmtData(c.prazo)}
                      {sc.dias !== null && <div className="text-xs text-slate-500">{fmtDias(sc.dias)}</div>}
                    </Td>
                    <Td>{nomeMembro(membros, c.responsavel_id)}</Td>
                    <Td>
                      <Badge nivel={sc.nivel}>{sc.rotulo}</Badge>
                    </Td>
                    {ctx.podeEditar && (
                      <Td className="whitespace-nowrap text-right">
                        <AcoesCondicionante c={c} membros={membros} />
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}

        {ctx.podeEditar && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <details className="rounded-lg border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                <Plus className="mr-1 inline h-4 w-4" />
                Nova condicionante
              </summary>
              <FormCondicionante licencaId={id} membros={membros} />
            </details>
            <details className="rounded-lg border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                <FileText className="mr-1 inline h-4 w-4" />
                Colar várias de uma vez (do PDF da licença)
              </summary>
              <form action={importarCondicionantes} className="mt-3 space-y-3">
                <input type="hidden" name="licenca_id" value={id} />
                <Field label="Uma condicionante por linha" dica='Linhas iniciadas por número (ex.: "2.1 - Apresentar…") têm o número separado automaticamente.'>
                  <Textarea name="texto" rows={6} required placeholder={"1. Apresentar relatório de monitoramento...\n2. Manter a área de reserva legal...\n3. Comunicar ao órgão..."} />
                </Field>
                <Field label="Prazo inicial (opcional, aplicado a todas)">
                  <Input type="date" name="prazo" />
                </Field>
                <Button type="submit" variante="secundario">
                  Importar
                </Button>
              </form>
            </details>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Documentos */}
        <Card titulo={`Documentos (${docs?.length ?? 0})`} acoes={ctx.podeEditar && <UploadDocumento orgId={ctx.orgId} licencaId={id} />}>
          {!docs?.length ? (
            <p className="text-sm text-slate-500">PDF da licença, protocolos, relatórios entregues, comprovantes…</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <a href={`/api/documentos/${d.id}`} className="flex min-w-0 items-center gap-2 text-slate-800 hover:text-emerald-700">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{d.nome}</span>
                  </a>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                    {d.tamanho_bytes ? `${Math.max(1, Math.round(d.tamanho_bytes / 1024))} KB` : ""}
                    {ctx.podeEditar && (
                      <form action={excluirDocumento}>
                        <input type="hidden" name="id" value={d.id} />
                        <BotaoConfirmar mensagem={`Excluir "${d.nome}"?`} className="hover:text-red-600" title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </BotaoConfirmar>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Histórico */}
        <Card titulo="Histórico de cumprimentos e alertas">
          {!cumprimentos?.length && !alertas?.length ? (
            <p className="text-sm text-slate-500">Nada registrado ainda.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {cumprimentos?.map((h) => {
                const cond = h.condicionantes as { numero: string | null; descricao: string };
                return (
                  <li key={h.id} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <div>
                        <span className="font-medium">{fmtData(h.data_cumprimento)}</span> — condicionante {cond.numero ?? ""}{" "}
                        {h.prazo_referente && <span className="text-slate-500">(prazo {fmtData(h.prazo_referente)})</span>}
                      </div>
                      {(h.protocolo || h.observacao) && (
                        <div className="text-xs text-slate-500">{[h.protocolo && `Protocolo ${h.protocolo}`, h.observacao].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                  </li>
                );
              })}
              {alertas?.map((a) => (
                <li key={a.id} className="text-xs text-slate-500">
                  ✉️ Alerta de {a.entidade === "renovacao" ? "renovação" : "vencimento"} enviado em {new Date(a.enviado_em).toLocaleDateString("pt-BR")} para{" "}
                  {(a.destinatarios as string[]).join(", ")}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Resumo({ rotulo, valor, extra }: { rotulo: string; valor: string; extra?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</div>
      <div className="mt-1 truncate text-lg font-semibold text-slate-900">{valor}</div>
      {extra && <div className="truncate text-xs text-slate-500">{extra}</div>}
    </div>
  );
}

function FormCondicionante({ licencaId, membros, c }: { licencaId: string; membros: { user_id: string; nome: string | null; email: string }[]; c?: Condicionante }) {
  return (
    <form action={salvarCondicionante} className="mt-3 grid gap-3 text-left sm:grid-cols-4">
      <input type="hidden" name="licenca_id" value={licencaId} />
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Nº">
        <Input name="numero" defaultValue={c?.numero ?? ""} placeholder="2.1" />
      </Field>
      <Field label="Tipo">
        <Select name="tipo" defaultValue={c?.tipo ?? "unica"}>
          <option value="unica">Única</option>
          <option value="periodica">Periódica</option>
          <option value="permanente">Permanente</option>
        </Select>
      </Field>
      <Field label="Periodicidade (meses)" dica="Só p/ periódicas">
        <Input type="number" min={1} name="periodicidade_meses" defaultValue={c?.periodicidade_meses ?? ""} placeholder="12" />
      </Field>
      <Field label="Próximo prazo">
        <Input type="date" name="prazo" defaultValue={c?.prazo ?? ""} />
      </Field>
      <Field label="Descrição *" className="sm:col-span-4">
        <Textarea name="descricao" required defaultValue={c?.descricao ?? ""} />
      </Field>
      <Field label="Responsável" className="sm:col-span-2">
        <Select name="responsavel_id" defaultValue={c?.responsavel_id ?? ""}>
          <option value="">Mesmo da licença</option>
          {membros.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.nome || m.email}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Observações" className="sm:col-span-2">
        <Input name="observacoes" defaultValue={c?.observacoes ?? ""} />
      </Field>
      <div className="sm:col-span-4">
        <Button type="submit">{c ? "Salvar" : "Adicionar condicionante"}</Button>
      </div>
    </form>
  );
}

function AcoesCondicionante({ c, membros }: { c: Condicionante; membros: { user_id: string; nome: string | null; email: string }[] }) {
  const aberta = c.situacao === "pendente" || c.situacao === "em_andamento";
  return (
    <div className="flex flex-col items-end gap-1">
      {aberta && (
        <details className="group relative">
          <summary className="cursor-pointer list-none text-xs font-medium text-emerald-700 hover:underline">
            {c.tipo === "periodica" ? "Registrar entrega" : "Marcar cumprida"}
          </summary>
          <form action={cumprirCondicionante} className="absolute right-0 z-10 mt-1 w-72 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
            <input type="hidden" name="id" value={c.id} />
            <Field label="Data">
              <Input type="date" name="data_cumprimento" defaultValue={hojeISO()} />
            </Field>
            <Field label="Protocolo / ofício">
              <Input name="protocolo" />
            </Field>
            <Field label="Observação">
              <Input name="observacao" />
            </Field>
            {c.tipo === "periodica" && <p className="text-xs text-slate-500">O prazo avançará {c.periodicidade_meses} mês(es) automaticamente.</p>}
            <Button type="submit" className="w-full">
              Confirmar
            </Button>
          </form>
        </details>
      )}
      {c.situacao === "pendente" && (
        <form action={mudarSituacaoCondicionante}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="licenca_id" value={c.licenca_id} />
          <input type="hidden" name="situacao" value="em_andamento" />
          <button className="text-xs text-slate-500 hover:underline">Em andamento</button>
        </form>
      )}
      {(c.situacao === "cumprida" || c.situacao === "nao_aplicavel") && (
        <form action={mudarSituacaoCondicionante}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="licenca_id" value={c.licenca_id} />
          <input type="hidden" name="situacao" value="pendente" />
          <button className="text-xs text-slate-500 hover:underline">Reabrir</button>
        </form>
      )}
      <details className="relative">
        <summary className="cursor-pointer list-none text-xs text-slate-500 hover:underline">Editar</summary>
        <div className="absolute right-0 z-10 mt-1 w-[34rem] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <FormCondicionante licencaId={c.licenca_id} membros={membros} c={c} />
          <form action={excluirCondicionante} className="mt-2 text-left">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="licenca_id" value={c.licenca_id} />
            <BotaoConfirmar mensagem="Excluir esta condicionante?" className="text-xs text-red-600 hover:underline">
              Excluir condicionante
            </BotaoConfirmar>
          </form>
        </div>
      </details>
    </div>
  );
}
