import { describe, expect, it } from "vitest";
import { FERRAMENTA, normalizarExtracao } from "../src/lib/extracao-ia";

const base = {
  tipo_documento: "LICENÇA DE OPERAÇÃO",
  numero: "1234/2025",
  processo: "  567/2024 ",
  orgao: "SEMAS-PA",
  data_emissao: "2025-03-10",
  data_validade: null,
  validade_meses: 48,
  antecedencia_renovacao_dias: null,
  atividade: "Armazenamento de grãos",
  empreendedor: { nome: "Agro Ltda", cpf_cnpj: "12.345.678/0001-90" },
  empreendimento: { nome: "Fazenda Sol", municipio: "Paragominas", uf: "pa", car: null, latitude: -3.0, longitude: 0 },
  condicionantes: [
    { numero: "1", descricao: "Apresentar relatório anual de monitoramento.", tipo: "periodica", periodicidade_meses: 12, prazo_data: null, prazo_dias_apos_emissao: null, prazo_meses_apos_emissao: null },
    { numero: "2", descricao: "Apresentar PGRS em 90 dias.", tipo: "unica", periodicidade_meses: null, prazo_data: null, prazo_dias_apos_emissao: 90, prazo_meses_apos_emissao: null },
    { numero: "3", descricao: "Manter a área de reserva legal.", tipo: "permanente", periodicidade_meses: null, prazo_data: "2026-01-01", prazo_dias_apos_emissao: null, prazo_meses_apos_emissao: null },
    { numero: "4", descricao: "Laudo semestral.", tipo: "periodica", periodicidade_meses: 6, prazo_data: "10/09/2025", prazo_dias_apos_emissao: null, prazo_meses_apos_emissao: null },
    { numero: "5", descricao: "   ", tipo: "unica" },
  ],
  observacoes: "Página 3 parcialmente ilegível.",
};

describe("normalizarExtracao", () => {
  const d = normalizarExtracao(base);
  it("campos da licença", () => {
    expect(d.tipo).toBe("LO – Licença de Operação");
    expect(d.processo).toBe("567/2024");
    expect(d.data_validade).toBe("2029-03-10"); // emissão + 48 meses
    expect(d.antecedencia_renovacao_dias).toBe(120);
    expect(d.uf).toBe("PA");
    expect(d.latitude).toBe(-3);
    expect(d.longitude).toBeNull(); // 0 é tratado como ausente
    expect(d.empresa_cnpj).toBe("12.345.678/0001-90");
  });
  it("prazos das condicionantes", () => {
    expect(d.condicionantes).toHaveLength(4);
    expect(d.condicionantes[0]).toMatchObject({ tipo: "periodica", periodicidade_meses: 12, prazo: "2026-03-10" });
    expect(d.condicionantes[1]).toMatchObject({ tipo: "unica", prazo: "2025-06-08" });
    expect(d.condicionantes[2]).toMatchObject({ tipo: "permanente", prazo: "" });
    expect(d.condicionantes[3]).toMatchObject({ prazo: "2025-09-10", periodicidade_meses: 6 });
    expect(d.condicionantes.every((c) => c.incluir)).toBe(true);
  });
  it("resposta vazia ou estranha não quebra", () => {
    const v = normalizarExtracao({ condicionantes: "x", empreendedor: null } as never);
    expect(v.tipo).toBe("Outro");
    expect(v.condicionantes).toEqual([]);
    expect(v.data_validade).toBe("");
  });
  it("schema da ferramenta exige todos os campos de topo", () => {
    expect(FERRAMENTA.input_schema.required).toContain("condicionantes");
    expect(Object.keys(FERRAMENTA.input_schema.properties).sort()).toEqual([...FERRAMENTA.input_schema.required].sort());
  });
});
