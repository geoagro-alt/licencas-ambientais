import { describe, expect, it } from "vitest";
import { interpretarPlanilha, lerCSV, mapearTipo, parseData } from "../src/lib/importacao";

const CAB = ["Tipo da Licença", "Número da Licença", "Número do processo", "Descrição", "Etiquetas", "Informações complementares", "Emissão", "Alerta", "Renovação", "Empreendedor", "Vencimento", "Empreendimento", "Licenciador", "Cidade", "Responsáveis", "Comentários", "Anexos", "Condicionantes", "Coordenadas", "Atividades", "Situação Empreendimento", "Protocolo Alteração Pendente", "Situação", "Data Criação", "Última atualização", "codigo"];
const linha = (o: Partial<Record<string, string | number | null>>) => CAB.map((c) => (c in o ? o[c] : null));

describe("parseData", () => {
  it("formatos comuns", () => {
    expect(parseData("09/08/2021")).toBe("2021-08-09");
    expect(parseData("10/02/2026 (60 dias)")).toBe("2026-02-10");
    expect(parseData("2027-03-05")).toBe("2027-03-05");
    expect(parseData("5-3-27")).toBe("2027-03-05");
    expect(parseData(45000)).toBe("2023-03-15");
    expect(parseData(new Date(Date.UTC(2025, 0, 31)))).toBe("2025-01-31");
    expect(parseData("31/02/2025")).toBeNull();
    expect(parseData(" - ")).toBeNull();
  });
});

describe("mapearTipo", () => {
  it("reconhece os tipos usuais", () => {
    expect(mapearTipo("Licença de Operação")).toBe("LO – Licença de Operação");
    expect(mapearTipo("LICENÇA AMBIENTAL RURAL - LAR")).toBe("LAR – Licença Ambiental Rural");
    expect(mapearTipo("LICENÇA DE ATIVIDADE RURAL")).toBe("LAR – Licença de Atividade Rural");
    expect(mapearTipo("OUTORGA DE DIREITO DE USO DA ÁGUA")).toBe("Outorga de uso de recursos hídricos");
    expect(mapearTipo("outorga")).toBe("Outorga de uso de recursos hídricos");
    expect(mapearTipo("DISPENSA DE OUTORGA")).toBe("Dispensa de outorga / Uso insignificante");
    expect(mapearTipo("Autorização Ambiental")).toBe("AuA – Autorização Ambiental");
    expect(mapearTipo("Licença Prévia")).toBe("LP – Licença Prévia");
    expect(mapearTipo("Licença de Instalação")).toBe("LI – Licença de Instalação");
    expect(mapearTipo("LICENÇA ESPECIAL XYZ")).toBe("Licença especial xyz");
  });
});

describe("interpretarPlanilha — exportação de outro sistema", () => {
  const r = interpretarPlanilha([
    CAB,
    linha({ "Tipo da Licença": "LICENÇA AMBIENTAL RURAL", "Número da Licença": "012/2021", "Número do processo": "292/2015", "Descrição": "AGRICULTURA  E PECUÁRIA", "Emissão": "09/08/2021", "Alerta": "10/02/2026 (60 dias)", "Renovação": "11/04/2026", "Empreendedor": "FULANO DE TAL", "Vencimento": "09/08/2026", "Empreendimento": "FAZENDA A", "Licenciador": "SEMMA X", "Cidade": " - ", "Situação": "protocolada renovação", codigo: "abc-1" }),
    linha({ "Tipo da Licença": "Licença de Operação", "Número da Licença": "002/2018", "Emissão": "16/01/2018", "Renovação": "18/07/2022", "Empreendedor": "EMPRESA B LTDA", "Vencimento": "16/01/2023", "Empreendimento": null, "Informações complementares": "OFICINA", "Situação": "protocolo de renovação feito fora do prazo", codigo: "abc-2" }),
    linha({ "Tipo da Licença": "OUTORGA", "Empreendedor": "EMPRESA C", "Vencimento": "01/01/2030", "Situação": "emitida" }),
    linha({}),
    linha({ "Tipo da Licença": "OUTORGA", "Vencimento": "01/01/2030" }),
  ]);

  it("lê as linhas válidas e avisa as inválidas", () => {
    expect(r.linhas).toHaveLength(3);
    expect(r.avisos.some((a) => a.includes("Linha 6"))).toBe(true);
  });
  it("mapeia campos", () => {
    const [a, b, c] = r.linhas;
    expect(a).toMatchObject({ empresa: "FULANO DE TAL", empreendimento: "FAZENDA A", numero: "012/2021", processo: "292/2015", orgao: "SEMMA X", municipio: null, data_emissao: "2021-08-09", data_validade: "2026-08-09", antecedencia_renovacao_dias: 120, situacao: "em_renovacao", codigo_externo: "abc-1", descricao: "AGRICULTURA E PECUÁRIA" });
    expect(b.empreendimento).toBe("EMPRESA B LTDA");
    expect(b.antecedencia_renovacao_dias).toBe(182);
    expect(b.situacao).toBe("em_renovacao");
    expect(b.observacoes).toContain("fora do prazo");
    expect(b.observacoes).toContain("OFICINA");
    expect(c.situacao).toBe("ativa");
    expect(c.antecedencia_renovacao_dias).toBe(120);
  });
});

describe("interpretarPlanilha — CSV deste sistema", () => {
  it("reimporta o próprio export", () => {
    const csv = '﻿"Empresa";"Empreendimento";"Município";"UF";"Tipo";"Número";"Órgão";"Processo";"Emissão";"Validade";"Protocolar renovação até";"Protocolo renovação";"Situação";"Status";"Responsável"\r\n"Agro X";"Faz; Boa";"Sorriso";"MT";"LO – Licença de Operação";"1/2024";"SEMA-MT";"";"01/01/2024";"01/01/2028";"03/09/2027";"";"ativa";"Vigente";"—"\r\n';
    const m = lerCSV(csv);
    expect(m[1][1]).toBe("Faz; Boa");
    const r = interpretarPlanilha(m);
    expect(r.linhas[0]).toMatchObject({ empresa: "Agro X", empreendimento: "Faz; Boa", municipio: "Sorriso", uf: "MT", tipo: "LO – Licença de Operação", data_validade: "2028-01-01", antecedencia_renovacao_dias: 120 });
  });
  it("sem coluna de empresa", () => {
    expect(interpretarPlanilha([["Foo", "Bar"], ["1", "2"]]).avisos[0]).toContain("empresa");
  });
});
