import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, Card, Field, Input, PageHeader, Tabela, Td, Th, Vazio } from "@/components/ui";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { salvarEmpresa } from "./actions";

export default async function EmpresasPage() {
  const ctx = await getContexto();
  const supabase = await createClient();
  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, razao_social, cnpj_cpf, contato_nome, contato_email, empreendimentos(id, licencas(id))")
    .eq("org_id", ctx.orgId)
    .order("razao_social");

  return (
    <>
      <PageHeader titulo="Clientes" subtitulo="Clientes (empreendedores/titulares) e seus empreendimentos — fazendas, unidades, obras" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" titulo={`${empresas?.length ?? 0} cliente(s)`}>
          {!empresas?.length ? (
            <Vazio>Nenhum cliente cadastrado ainda. Comece pelo formulário ao lado.</Vazio>
          ) : (
            <Tabela>
              <thead>
                <tr>
                  <Th>Razão social</Th>
                  <Th>CNPJ/CPF</Th>
                  <Th>Contato</Th>
                  <Th className="text-right">Empreend.</Th>
                  <Th className="text-right">Licenças</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresas.map((e) => {
                  const emps = (e.empreendimentos ?? []) as { id: string; licencas: { id: string }[] }[];
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <Td>
                        <Link href={`/clientes/${e.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                          {e.razao_social}
                        </Link>
                      </Td>
                      <Td>{e.cnpj_cpf ?? "—"}</Td>
                      <Td>{e.contato_nome ?? e.contato_email ?? "—"}</Td>
                      <Td className="text-right">{emps.length}</Td>
                      <Td className="text-right">{emps.reduce((s, x) => s + (x.licencas?.length ?? 0), 0)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
          )}
        </Card>

        {ctx.podeEditar && (
          <Card titulo="Novo cliente">
            <form action={salvarEmpresa} className="space-y-3">
              <Field label="Razão social / nome *">
                <Input name="razao_social" required />
              </Field>
              <Field label="CNPJ / CPF">
                <Input name="cnpj_cpf" />
              </Field>
              <Field label="Contato">
                <Input name="contato_nome" />
              </Field>
              <Field label="E-mail do contato">
                <Input name="contato_email" type="email" />
              </Field>
              <Field label="Telefone">
                <Input name="telefone" />
              </Field>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" /> Cadastrar
              </Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
