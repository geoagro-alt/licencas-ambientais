import Link from "next/link";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { TIPOS_LICENCA, type Licenca, type Membro } from "@/lib/types";
import { salvarLicenca } from "./actions";

interface Props {
  licenca?: Licenca;
  empreendimentos: { id: string; nome: string; municipio: string | null; uf: string | null; empresas: { razao_social: string } | null }[];
  membros: Membro[];
  empreendimentoPadrao?: string;
}

export function FormLicenca({ licenca, empreendimentos, membros, empreendimentoPadrao }: Props) {
  if (empreendimentos.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Antes de cadastrar uma licença, cadastre a empresa e o empreendimento em{" "}
          <Link href="/empresas" className="font-medium text-emerald-700 hover:underline">
            Empresas
          </Link>
          .
        </p>
      </Card>
    );
  }

  // agrupa empreendimentos por empresa
  const grupos = new Map<string, typeof empreendimentos>();
  for (const e of empreendimentos) {
    const k = e.empresas?.razao_social ?? "Sem empresa";
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  const tipoAtual = licenca?.tipo;
  const tipos = tipoAtual && !TIPOS_LICENCA.includes(tipoAtual as never) ? [tipoAtual, ...TIPOS_LICENCA] : TIPOS_LICENCA;

  return (
    <form action={salvarLicenca} className="space-y-6">
      {licenca && <input type="hidden" name="id" value={licenca.id} />}

      <Card titulo="Identificação">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Empreendimento *" className="md:col-span-2">
            <Select name="empreendimento_id" required defaultValue={licenca?.empreendimento_id ?? empreendimentoPadrao ?? ""}>
              <option value="" disabled>
                Selecione…
              </option>
              {[...grupos].map(([empresa, lista]) => (
                <optgroup key={empresa} label={empresa}>
                  {lista.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                      {e.municipio ? ` — ${e.municipio}${e.uf ? `/${e.uf}` : ""}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Tipo *">
            <Select name="tipo" required defaultValue={licenca?.tipo ?? "LO – Licença de Operação"}>
              {tipos.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Número">
            <Input name="numero" defaultValue={licenca?.numero ?? ""} placeholder="Ex.: 1234/2025" />
          </Field>
          <Field label="Órgão emissor">
            <Input name="orgao" defaultValue={licenca?.orgao ?? ""} placeholder="Ex.: SEMA-MT, IBAMA, CETESB, ANA" list="orgaos" />
            <datalist id="orgaos">
              {["IBAMA", "ANA", "SEMA-MT", "SEMAD-GO", "IMASUL", "CETESB", "FEAM/SEMAD-MG", "INEMA", "IAT-PR", "FEPAM", "IMA-SC", "NATURATINS", "SEMAS-PA", "Prefeitura"].map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
          <Field label="Nº do processo">
            <Input name="processo" defaultValue={licenca?.processo ?? ""} />
          </Field>
          <Field label="Objeto / descrição" className="md:col-span-2">
            <Textarea name="descricao" defaultValue={licenca?.descricao ?? ""} placeholder="Atividade licenciada, capacidade, área…" />
          </Field>
        </div>
      </Card>

      <Card titulo="Prazos">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Data de emissão">
            <Input type="date" name="data_emissao" defaultValue={licenca?.data_emissao ?? ""} />
          </Field>
          <Field label="Data de validade" dica="Deixe em branco se não tiver vencimento.">
            <Input type="date" name="data_validade" defaultValue={licenca?.data_validade ?? ""} />
          </Field>
          <Field label="Antecedência p/ renovação (dias)" dica="LC 140/2011: 120 dias. Confira a regra do seu órgão.">
            <Input type="number" min={0} name="antecedencia_renovacao_dias" defaultValue={licenca?.antecedencia_renovacao_dias ?? 120} />
          </Field>
          <Field label="Situação">
            <Select name="situacao" defaultValue={licenca?.situacao ?? "ativa"}>
              <option value="ativa">Ativa</option>
              <option value="em_renovacao">Em renovação (protocolada)</option>
              <option value="encerrada">Encerrada / substituída</option>
            </Select>
          </Field>
          <Field label="Protocolo da renovação">
            <Input name="protocolo_renovacao" defaultValue={licenca?.protocolo_renovacao ?? ""} />
          </Field>
          <Field label="Data do protocolo">
            <Input type="date" name="data_protocolo_renovacao" defaultValue={licenca?.data_protocolo_renovacao ?? ""} />
          </Field>
        </div>
      </Card>

      <Card titulo="Gestão">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Responsável" dica="Recebe os alertas desta licença e de suas condicionantes.">
            <Select name="responsavel_id" defaultValue={licenca?.responsavel_id ?? ""}>
              <option value="">—</option>
              {membros.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.nome || m.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="observacoes" defaultValue={licenca?.observacoes ?? ""} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={licenca ? `/licencas/${licenca.id}` : "/licencas"} className="px-3.5 py-2 text-sm text-slate-600 hover:text-slate-900">
          Cancelar
        </Link>
        <Button type="submit">{licenca ? "Salvar alterações" : "Cadastrar licença"}</Button>
      </div>
    </form>
  );
}
