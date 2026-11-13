"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Badge, Button, Card, Tabela, Td, Th } from "@/components/ui";
import { interpretarPlanilha, lerCSV, type Celula, type ResultadoLeitura } from "@/lib/importacao";
import { fmtData, statusLicenca } from "@/lib/prazos";
import { importarLicencas, type ResumoImportacao } from "./actions";

export function Importador() {
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrar, setEncerrar] = useState(false);
  const [meses, setMeses] = useState(12);
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [pendente, iniciar] = useTransition();

  async function abrir(file: File | undefined) {
    if (!file) return;
    setErro(null);
    setResumo(null);
    setLeitura(null);
    setArquivo(file.name);
    try {
      let matriz: Celula[][];
      if (/\.(csv|txt)$/i.test(file.name)) {
        matriz = lerCSV(await file.text());
      } else if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        matriz = (await readSheet(file)) as Celula[][];
      } else {
        throw new Error("Formato não suportado. Use .xlsx (Excel) ou .csv. Arquivos .xls antigos: abra no Excel e salve como .xlsx.");
      }
      setLeitura(interpretarPlanilha(matriz));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  function confirmar() {
    if (!leitura) return;
    iniciar(async () => {
      const r = await importarLicencas(leitura.linhas, { encerrarVencidasHaMeses: encerrar ? meses : null });
      setResumo(r);
      if (r.ok) setLeitura(null);
    });
  }

  const linhas = leitura?.linhas ?? [];
  const empresas = new Set(linhas.map((l) => l.empresa.toLowerCase())).size;
  const contagem = linhas.reduce(
    (acc, l) => {
      const s = statusLicenca({ ...l, protocolo_renovacao: null });
      acc[s.rotulo] = (acc[s.rotulo] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <Card>
        <input ref={input} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
        <div
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            abrir(e.dataTransfer.files?.[0]);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-emerald-400 hover:bg-emerald-50/40"
        >
          <FileSpreadsheet className="h-8 w-8 text-emerald-700" />
          <div className="text-sm font-medium text-slate-800">{arquivo ?? "Clique ou arraste a planilha aqui"}</div>
          <div className="text-xs text-slate-500">Excel (.xlsx) ou CSV · uma licença por linha · a primeira linha deve ter os nomes das colunas</div>
        </div>
        <details className="mt-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">Quais colunas são reconhecidas?</summary>
          <p className="mt-2">
            O importador reconhece automaticamente exportações de outros sistemas de licenciamento e o CSV deste sistema. Nomes aceitos (sem
            diferenciar maiúsculas/acentos):
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
            <li><b>Cliente</b>: Empreendedor, Cliente, Empresa, Razão social, Titular</li>
            <li><b>Empreendimento</b>: Empreendimento, Fazenda, Unidade, Imóvel (se vazio, usa o nome do cliente)</li>
            <li><b>Tipo</b>: Tipo da Licença, Tipo · <b>Número</b>: Número da Licença, Número · <b>Processo</b>: Número do processo</li>
            <li><b>Órgão</b>: Licenciador, Órgão · <b>Município</b>: Cidade · <b>UF</b></li>
            <li><b>Emissão</b> e <b>Vencimento/Validade</b> (dd/mm/aaaa) · <b>Renovação</b> (calcula a antecedência)</li>
            <li><b>Situação</b>: “protocolada renovação” vira <i>Em renovação</i> · <b>codigo</b>: evita duplicar ao reimportar</li>
          </ul>
        </details>
      </Card>

      {erro && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {resumo && (
        <div className={`rounded-xl px-5 py-4 text-sm ${resumo.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-700"}`}>
          {resumo.ok ? (
            <>
              <div className="font-semibold">Importação concluída ✔</div>
              <ul className="mt-1 list-disc pl-5">
                <li>{resumo.licencasCriadas} licença(s) nova(s) e {resumo.licencasAtualizadas} atualizada(s)</li>
                <li>{resumo.empresasCriadas} cliente(s) e {resumo.empreendimentosCriados} empreendimento(s) cadastrados</li>
                {resumo.encerradas > 0 && <li>{resumo.encerradas} licença(s) antiga(s) marcada(s) como encerrada(s)</li>}
              </ul>
              <div className="mt-3 flex gap-3">
                <Link href="/licencas" className="font-medium text-emerald-800 underline">Ver licenças</Link>
                <Link href="/dashboard" className="font-medium text-emerald-800 underline">Ir para o painel</Link>
              </div>
            </>
          ) : (
            <>Não foi possível importar: {resumo.erro}</>
          )}
        </div>
      )}

      {leitura && (
        <Card
          titulo={`Prévia: ${linhas.length} licença(s) de ${empresas} cliente(s)`}
          acoes={
            linhas.length > 0 && (
              <Button onClick={confirmar} disabled={pendente}>
                <Upload className="h-4 w-4" /> {pendente ? "Importando…" : `Importar ${linhas.length} licença(s)`}
              </Button>
            )
          }
        >
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {Object.entries(contagem).map(([rotulo, n]) => (
              <span key={rotulo} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                {rotulo}: <b>{n}</b>
              </span>
            ))}
          </div>

          {linhas.length > 0 && (
            <label className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input type="checkbox" checked={encerrar} onChange={(e) => setEncerrar(e.target.checked)} className="h-4 w-4" />
              Marcar como <b>encerradas</b> as licenças vencidas há mais de
              <input
                type="number"
                min={1}
                value={meses}
                onChange={(e) => setMeses(Math.max(1, parseInt(e.target.value || "12", 10)))}
                className="w-16 rounded border border-amber-300 bg-white px-2 py-0.5"
              />
              meses (sem protocolo) — assim elas não geram alertas.
            </label>
          )}

          {leitura.avisos.length > 0 && (
            <details className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700" open={linhas.length === 0}>
              <summary className="cursor-pointer font-medium">{leitura.avisos.length} aviso(s)</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {leitura.avisos.slice(0, 50).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          )}

          {linhas.length > 0 && (
            <>
              <Tabela>
                <thead>
                  <tr>
                    <Th>Linha</Th>
                    <Th>Empreendimento</Th>
                    <Th>Tipo</Th>
                    <Th>Número</Th>
                    <Th>Órgão</Th>
                    <Th>Validade</Th>
                    <Th>Situação</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhas.slice(0, 30).map((l) => {
                    const s = statusLicenca({ ...l, protocolo_renovacao: null });
                    return (
                      <tr key={l.linha}>
                        <Td className="text-xs text-slate-400">{l.linha}</Td>
                        <Td>
                          {l.empreendimento}
                        </Td>
                        <Td className="text-xs">{l.tipo}</Td>
                        <Td>{l.numero ?? "—"}</Td>
                        <Td className="text-xs">{l.orgao ?? "—"}</Td>
                        <Td className="whitespace-nowrap">{fmtData(l.data_validade)}</Td>
                        <Td>
                          <Badge nivel={s.nivel}>{s.rotulo}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabela>
              {linhas.length > 30 && <p className="mt-2 text-xs text-slate-500">…e mais {linhas.length - 30} linha(s).</p>}
              <p className="mt-4 text-xs text-slate-500">
                Colunas usadas: {leitura.colunasReconhecidas.join(", ")}.
                {leitura.colunasIgnoradas.length > 0 && <> Ignoradas: {leitura.colunasIgnoradas.join(", ")}.</>} Reimportar a mesma planilha
                atualiza as licenças em vez de duplicar.
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
