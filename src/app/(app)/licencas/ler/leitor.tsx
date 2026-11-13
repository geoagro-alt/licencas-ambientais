"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { TIPOS_ACEITOS, type CondicionanteExtraida } from "@/lib/extracao-ia";
import { TIPOS_LICENCA, UFS, type Membro } from "@/lib/types";
import { analisarDocumento, descartarArquivoLido, salvarLeitura, type DadosRevisados, type OpcaoEmpresa } from "./actions";

type Etapa = "envio" | "lendo" | "revisao" | "salvando";

/** Reduz fotos grandes (celular) para no máx. 2000 px em JPEG — a IA lê igual e o envio fica rápido. */
async function prepararImagem(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  if (escala === 1 && file.size < 3.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((ok) => canvas.toBlob((b) => ok(b!), "image/jpeg", 0.85));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function LeitorIA({ orgId, membros, iaAtiva, maxBytes }: { orgId: string; membros: Membro[]; iaAtiva: boolean; maxBytes: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>("envio");
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosRevisados | null>(null);
  const [empresas, setEmpresas] = useState<OpcaoEmpresa[]>([]);

  async function enviar(original: File | undefined) {
    if (!original) return;
    setErro(null);
    try {
      if (!TIPOS_ACEITOS[original.type]) throw new Error("Envie um PDF ou uma foto (JPG, PNG, WEBP).");
      if (original.type === "application/pdf" && original.size > maxBytes) throw new Error(`PDF muito grande (máx. ${Math.round(maxBytes / 1024 / 1024)} MB). Envie só as páginas da licença.`);
      setEtapa("lendo");
      const file = await prepararImagem(original);
      const seguro = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");
      const path = `${orgId}/ia/${crypto.randomUUID()}-${seguro}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type });
      if (error) throw new Error(`Falha no envio: ${error.message}`);

      const r = await analisarDocumento({ storage_path: path, mime: file.type });
      if (!r.ok) throw new Error(r.erro);
      setEmpresas(r.empresas);
      setDados({
        ...r.dados,
        empresa_id: r.empresaId,
        empreendimento_id: r.empreendimentoId,
        responsavel_id: "",
        arquivo: { storage_path: path, nome: original.name, mime: file.type, tamanho: file.size },
      });
      setEtapa("revisao");
    } catch (e) {
      setErro((e as Error).message);
      setEtapa("envio");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function salvar() {
    if (!dados) return;
    setErro(null);
    setEtapa("salvando");
    const r = await salvarLeitura(dados);
    if (r.ok) router.push(`/licencas/${r.licencaId}`);
    else {
      setErro(r.erro);
      setEtapa("revisao");
    }
  }

  const set = <K extends keyof DadosRevisados>(k: K, v: DadosRevisados[K]) => setDados((d) => (d ? { ...d, [k]: v } : d));
  const setCond = (i: number, patch: Partial<CondicionanteExtraida>) =>
    setDados((d) => (d ? { ...d, condicionantes: d.condicionantes.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : d));

  // ------------------------------------------------------------ envio / leitura
  if (etapa === "envio" || etapa === "lendo") {
    return (
      <div className="space-y-4">
        {!iaAtiva && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            A leitura por IA ainda não está ativada neste site: falta cadastrar na Vercel a chave GEMINI_API_KEY (grátis, criada em aistudio.google.com) ou ANTHROPIC_API_KEY. Veja o README do projeto.
          </p>
        )}
        <Card>
          <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
          <div
            onClick={() => etapa === "envio" && input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (etapa === "envio") enviar(e.dataTransfer.files?.[0]);
            }}
            className={cx(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center",
              etapa === "lendo" ? "border-emerald-300 bg-emerald-50/50" : "cursor-pointer border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40",
            )}
          >
            <Sparkles className={cx("h-9 w-9 text-emerald-700", etapa === "lendo" && "animate-pulse")} />
            {etapa === "lendo" ? (
              <>
                <div className="text-sm font-medium text-slate-800">Lendo o documento…</div>
                <div className="text-xs text-slate-500">A IA está extraindo dados e condicionantes. Leva de 15 a 60 segundos.</div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-slate-800">Clique, arraste ou fotografe a licença</div>
                <div className="text-xs text-slate-500">PDF da licença (até {Math.round(maxBytes / 1024 / 1024)} MB) ou foto nítida de cada página · você revisa tudo antes de salvar</div>
              </>
            )}
          </div>
        </Card>
        {erro && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      </div>
    );
  }

  // ------------------------------------------------------------ revisão
  const d = dados!;
  const empresaSel = empresas.find((e) => e.id === d.empresa_id);
  const tipos = d.tipo && !TIPOS_LICENCA.includes(d.tipo as never) ? [d.tipo, ...TIPOS_LICENCA] : [...TIPOS_LICENCA];
  const marcadas = d.condicionantes.filter((c) => c.incluir).length;

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        Confira os dados lidos de <b className="mx-1">{d.arquivo.nome}</b> e corrija o que for preciso. Nada é gravado antes de você clicar em Salvar.
      </p>
      {d.observacoes && (
        <p className="flex items-start gap-2 whitespace-pre-line rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {d.observacoes}
        </p>
      )}

      <Card titulo="Cliente e empreendimento">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cliente (empreendedor)" dica={d.empresa_id ? "Já cadastrado — a licença será vinculada a ele." : "Será cadastrado como novo."}>
            <Select value={d.empresa_id} onChange={(e) => setDados({ ...d, empresa_id: e.target.value, empreendimento_id: "" })}>
              <option value="">➕ Novo cliente: {d.empresa_nome || "(informe o nome)"}</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.razao_social}
                </option>
              ))}
            </Select>
          </Field>
          {!d.empresa_id ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nome do novo cliente">
                <Input value={d.empresa_nome} onChange={(e) => set("empresa_nome", e.target.value)} />
              </Field>
              <Field label="CPF/CNPJ">
                <Input value={d.empresa_cnpj} onChange={(e) => set("empresa_cnpj", e.target.value)} />
              </Field>
            </div>
          ) : (
            <div />
          )}
          <Field label="Empreendimento">
            <Select value={d.empreendimento_id} onChange={(e) => set("empreendimento_id", e.target.value)}>
              <option value="">➕ Novo: {d.empreendimento_nome || d.empresa_nome || "(informe o nome)"}</option>
              {empresaSel?.empreendimentos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
          {!d.empreendimento_id && (
            <div className="grid grid-cols-6 gap-2">
              <Field label="Nome do novo empreendimento" className="col-span-6">
                <Input value={d.empreendimento_nome} onChange={(e) => set("empreendimento_nome", e.target.value)} placeholder={d.empresa_nome} />
              </Field>
              <Field label="Município" className="col-span-4">
                <Input value={d.municipio} onChange={(e) => set("municipio", e.target.value)} />
              </Field>
              <Field label="UF" className="col-span-2">
                <Select value={d.uf} onChange={(e) => set("uf", e.target.value)}>
                  <option value="">—</option>
                  {UFS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </Field>
              <Field label="CAR" className="col-span-6">
                <Input value={d.car} onChange={(e) => set("car", e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card titulo="Licença">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tipo">
            <Select value={d.tipo} onChange={(e) => set("tipo", e.target.value)}>
              {tipos.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Número">
            <Input value={d.numero} onChange={(e) => set("numero", e.target.value)} />
          </Field>
          <Field label="Processo">
            <Input value={d.processo} onChange={(e) => set("processo", e.target.value)} />
          </Field>
          <Field label="Órgão emissor">
            <Input value={d.orgao} onChange={(e) => set("orgao", e.target.value)} />
          </Field>
          <Field label="Emissão">
            <Input type="date" value={d.data_emissao} onChange={(e) => set("data_emissao", e.target.value)} />
          </Field>
          <Field label="Validade" dica={!d.data_validade ? "Não encontrada no documento — confira." : undefined}>
            <Input type="date" value={d.data_validade} onChange={(e) => set("data_validade", e.target.value)} />
          </Field>
          <Field label="Antecedência p/ renovação (dias)">
            <Input type="number" min={0} value={d.antecedencia_renovacao_dias} onChange={(e) => set("antecedencia_renovacao_dias", parseInt(e.target.value || "0", 10))} />
          </Field>
          <Field label="Responsável">
            <Select value={d.responsavel_id} onChange={(e) => set("responsavel_id", e.target.value)}>
              <option value="">—</option>
              {membros.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.nome || m.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Atividade / objeto" className="md:col-span-3">
            <Textarea value={d.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} />
          </Field>
        </div>
      </Card>

      <Card
        titulo={`Condicionantes (${marcadas} de ${d.condicionantes.length} marcadas)`}
        acoes={
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
            onClick={() =>
              set("condicionantes", [...d.condicionantes, { incluir: true, numero: "", descricao: "", tipo: "unica", periodicidade_meses: null, prazo: "" }])
            }
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        }
      >
        {d.condicionantes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma condicionante encontrada no documento.</p>
        ) : (
          <ul className="space-y-3">
            {d.condicionantes.map((c, i) => (
              <li key={i} className={cx("rounded-lg border p-3", c.incluir ? "border-slate-200" : "border-dashed border-slate-200 opacity-50")}>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="checkbox" checked={c.incluir} onChange={(e) => setCond(i, { incluir: e.target.checked })} className="h-4 w-4" title="Incluir" />
                  <Input value={c.numero} onChange={(e) => setCond(i, { numero: e.target.value })} placeholder="Nº" className="w-20" />
                  <Select
                    value={c.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as CondicionanteExtraida["tipo"];
                      setCond(i, { tipo, periodicidade_meses: tipo === "periodica" ? (c.periodicidade_meses ?? 12) : null, prazo: tipo === "permanente" ? "" : c.prazo });
                    }}
                    className="max-w-36"
                  >
                    <option value="unica">Única</option>
                    <option value="periodica">Periódica</option>
                    <option value="permanente">Permanente</option>
                  </Select>
                  {c.tipo === "periodica" && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      a cada
                      <Input type="number" min={1} value={c.periodicidade_meses ?? 12} onChange={(e) => setCond(i, { periodicidade_meses: parseInt(e.target.value || "12", 10) })} className="w-16" />
                      meses
                    </span>
                  )}
                  {c.tipo !== "permanente" && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      prazo
                      <Input type="date" value={c.prazo} onChange={(e) => setCond(i, { prazo: e.target.value })} className="w-40" />
                    </span>
                  )}
                  <button
                    type="button"
                    className="ml-auto text-slate-400 hover:text-red-600"
                    title="Remover"
                    onClick={() => set("condicionantes", d.condicionantes.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Textarea value={c.descricao} onChange={(e) => setCond(i, { descricao: e.target.value })} rows={2} className="mt-2" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {erro && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <div className="flex justify-end gap-2">
        <Button
          variante="secundario"
          onClick={() => {
            // desistiu deste documento: remove o arquivo temporário do Storage
            if (dados) void descartarArquivoLido(dados.arquivo.storage_path);
            setDados(null);
            setEtapa("envio");
          }}
          disabled={etapa === "salvando"}
        >
          Ler outro documento
        </Button>
        <Button onClick={salvar} disabled={etapa === "salvando"}>
          {etapa === "salvando" ? "Salvando…" : `Salvar licença${marcadas ? ` e ${marcadas} condicionante(s)` : ""}`}
        </Button>
      </div>
    </div>
  );
}
