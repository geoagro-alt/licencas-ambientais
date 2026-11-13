import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Field, Input, LinkButton, PageHeader, Select, Tabela, Td, Textarea, Th, Vazio } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { siglaTipo } from "@/lib/dados";
import { fmtData, fmtDias, statusLicenca } from "@/lib/prazos";
import { createClient } from "@/lib/supabase/server";
import { UFS, type Empreendimento, type Empresa, type Licenca } from "@/lib/types";
import { excluirEmpreendimento, excluirEmpresa, salvarEmpreendimento, salvarEmpresa } from "../actions";

export default async function EmpresaPage({ params }: PageProps<"/empresas/[id]">) {
  const { id } = await params;
  const ctx = await getContexto();
  const supabase = await createClient();

  const { data: empresa } = await supabase.from("empresas").select("*").eq("id", id).maybeSingle<Empresa>();
  if (!empresa) notFound();

  const { data: emps } = await supabase
    .from("empreendimentos")
    .select("*, licencas(*)")
    .eq("empresa_id", id)
    .order("nome");
  const empreendimentos = (emps ?? []) as (Empreendimento & { licencas: Licenca[] })[];

  return (
    <>
      <PageHeader
        titulo={empresa.razao_social}
        subtitulo={[empresa.cnpj_cpf, empresa.contato_nome, empresa.contato_email, empresa.telefone].filter(Boolean).join(" · ") || "Empresa"}
        acoes={
          ctx.podeEditar && (
            <LinkButton href={`/licencas/nova?empresa=${id}`}>
              <Plus className="h-4 w-4" /> Nova licença
            </LinkButton>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {empreendimentos.length === 0 && <Vazio>Cadastre o primeiro empreendimento (fazenda, unidade, obra) ao lado.</Vazio>}
          {empreendimentos.map((emp) => (
            <Card
              key={emp.id}
              titulo={
                <span>
                  {emp.nome}
                  <span className="ml-2 font-normal text-slate-500">
                    {[emp.atividade, emp.municipio && `${emp.municipio}${emp.uf ? `/${emp.uf}` : ""}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              }
              acoes={
                ctx.podeEditar && (
                  <form action={excluirEmpreendimento}>
                    <input type="hidden" name="id" value={emp.id} />
                    <input type="hidden" name="empresa_id" value={id} />
                    <button className="text-slate-400 hover:text-red-600" title="Excluir empreendimento e suas licenças">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                )
              }
            >
              {emp.car && <p className="mb-3 text-xs text-slate-500">CAR: {emp.car}</p>}
              {emp.licencas.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhuma licença.{" "}
                  {ctx.podeEditar && (
                    <Link className="text-emerald-700 hover:underline" href={`/licencas/nova?empreendimento=${emp.id}`}>
                      Cadastrar
                    </Link>
                  )}
                </p>
              ) : (
                <Tabela>
                  <thead>
                    <tr>
                      <Th>Licença</Th>
                      <Th>Órgão</Th>
                      <Th>Validade</Th>
                      <Th>Situação</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emp.licencas.map((l) => {
                      const s = statusLicenca(l);
                      return (
                        <tr key={l.id}>
                          <Td>
                            <Link href={`/licencas/${l.id}`} className="font-medium hover:text-emerald-700">
                              {siglaTipo(l.tipo)} {l.numero && `nº ${l.numero}`}
                            </Link>
                          </Td>
                          <Td>{l.orgao ?? "—"}</Td>
                          <Td>
                            {fmtData(l.data_validade)}
                            {s.dias !== null && <div className="text-xs text-slate-500">{fmtDias(s.dias)}</div>}
                          </Td>
                          <Td>
                            <Badge nivel={s.nivel}>{s.rotulo}</Badge>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Tabela>
              )}
            </Card>
          ))}
        </div>

        {ctx.podeEditar && (
          <div className="space-y-6">
            <Card titulo="Novo empreendimento">
              <form action={salvarEmpreendimento} className="space-y-3">
                <input type="hidden" name="empresa_id" value={id} />
                <Field label="Nome *">
                  <Input name="nome" required placeholder="Ex.: Fazenda Santa Rita" />
                </Field>
                <Field label="Atividade">
                  <Input name="atividade" placeholder="Ex.: Irrigação, silvicultura, armazém…" />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Município" className="col-span-2">
                    <Input name="municipio" />
                  </Field>
                  <Field label="UF">
                    <Select name="uf" defaultValue="">
                      <option value="">—</option>
                      {UFS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Nº do CAR">
                  <Input name="car" />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Latitude">
                    <Input name="latitude" placeholder="-15.60" />
                  </Field>
                  <Field label="Longitude">
                    <Input name="longitude" placeholder="-56.10" />
                  </Field>
                </div>
                <Button type="submit" className="w-full">
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </form>
            </Card>

            <Card titulo="Dados da empresa">
              <form action={salvarEmpresa} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <Field label="Razão social">
                  <Input name="razao_social" defaultValue={empresa.razao_social} required />
                </Field>
                <Field label="CNPJ / CPF">
                  <Input name="cnpj_cpf" defaultValue={empresa.cnpj_cpf ?? ""} />
                </Field>
                <Field label="Contato">
                  <Input name="contato_nome" defaultValue={empresa.contato_nome ?? ""} />
                </Field>
                <Field label="E-mail">
                  <Input name="contato_email" type="email" defaultValue={empresa.contato_email ?? ""} />
                </Field>
                <Field label="Telefone">
                  <Input name="telefone" defaultValue={empresa.telefone ?? ""} />
                </Field>
                <Field label="Observações">
                  <Textarea name="observacoes" defaultValue={empresa.observacoes ?? ""} />
                </Field>
                <Button type="submit" variante="secundario" className="w-full">
                  Salvar
                </Button>
              </form>
              <form action={excluirEmpresa} className="mt-3">
                <input type="hidden" name="id" value={id} />
                <Button type="submit" variante="perigo" className="w-full">
                  Excluir empresa (e tudo vinculado)
                </Button>
              </form>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
