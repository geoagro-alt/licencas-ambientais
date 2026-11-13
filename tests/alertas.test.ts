import { describe, expect, it } from "vitest";
import { chaveAlerta, distribuir, itensDeLicencas, marcoPara, selecionarAlertas, type ItemAlerta, type LinhaLicenca } from "../src/lib/alertas";
import { limiteRenovacao, statusLicenca, statusCondicionante, avancarPrazo } from "../src/lib/prazos";

const MARCOS = [120, 90, 60, 30, 15, 7, 1, 0];
const HOJE = "2026-11-13";

describe("marcoPara", () => {
  it("escolhe o menor marco que o item já cruzou", () => {
    expect(marcoPara(200, MARCOS)).toBeNull();
    expect(marcoPara(120, MARCOS)).toBe(120);
    expect(marcoPara(95, MARCOS)).toBe(120);
    expect(marcoPara(89, MARCOS)).toBe(90);
    expect(marcoPara(10, MARCOS)).toBe(15);
    expect(marcoPara(1, MARCOS)).toBe(1);
    expect(marcoPara(0, MARCOS)).toBe(0);
  });
  it("itens vencidos geram um marco por semana", () => {
    expect(marcoPara(-1, MARCOS)).toBe(-1);
    expect(marcoPara(-7, MARCOS)).toBe(-1);
    expect(marcoPara(-8, MARCOS)).toBe(-8);
    expect(marcoPara(-14, MARCOS)).toBe(-8);
    expect(marcoPara(-15, MARCOS)).toBe(-15);
  });
});

const item = (id: string, data: string, resp: string | null = null): ItemAlerta => ({
  entidade: "condicionante", id, licencaId: "L", dataReferencia: data, titulo: "t", detalhe: "d", empresa: "e", responsavelId: resp,
});

describe("selecionarAlertas", () => {
  it("não repete marco já enviado, mas recupera marco perdido", () => {
    const i = item("c1", "2026-11-23"); // 10 dias -> marco 15
    expect(selecionarAlertas([i], MARCOS, new Set(), HOJE)).toHaveLength(1);
    const ja = new Set([chaveAlerta("condicionante", "c1", "2026-11-23", 15)]);
    expect(selecionarAlertas([i], MARCOS, ja, HOJE)).toHaveLength(0);
    // marco 30 enviado antes, mas o de 15 não -> envia
    const ja30 = new Set([chaveAlerta("condicionante", "c1", "2026-11-23", 30)]);
    expect(selecionarAlertas([i], MARCOS, ja30, HOJE)[0].marco).toBe(15);
  });
  it("se a data mudar, o ciclo de avisos recomeça", () => {
    const ja = new Set([chaveAlerta("condicionante", "c1", "2026-11-23", 15)]);
    expect(selecionarAlertas([item("c1", "2026-11-24")], MARCOS, ja, HOJE)).toHaveLength(1);
  });
  it("ignora itens fora da janela e ordena por urgência", () => {
    const r = selecionarAlertas([item("a", "2027-12-01"), item("b", "2026-12-01"), item("c", "2026-11-01")], MARCOS, new Set(), HOJE);
    expect(r.map((x) => x.id)).toEqual(["c", "b"]);
  });
});

describe("licenças", () => {
  const lic = (over: Partial<LinhaLicenca> = {}): LinhaLicenca => ({
    id: "l1", tipo: "LO – Licença de Operação", numero: "10/2024", data_validade: "2027-03-01", antecedencia_renovacao_dias: 120,
    situacao: "ativa", protocolo_renovacao: null, responsavel_id: null, empreendimentos: { nome: "Faz", empresas: { razao_social: "Emp" } }, ...over,
  });
  it("calcula o prazo de renovação (120 dias antes)", () => {
    expect(limiteRenovacao({ data_validade: "2027-03-01", antecedencia_renovacao_dias: 120 })).toBe("2026-11-01");
  });
  it("gera item de validade e de renovação; renovação some após protocolo", () => {
    expect(itensDeLicencas([lic()]).map((i) => i.entidade)).toEqual(["licenca", "renovacao"]);
    expect(itensDeLicencas([lic({ protocolo_renovacao: "123" })]).map((i) => i.entidade)).toEqual(["licenca"]);
    expect(itensDeLicencas([lic({ situacao: "em_renovacao" })])).toHaveLength(0);
  });
  it("status", () => {
    const base = { antecedencia_renovacao_dias: 120, situacao: "ativa" as const, protocolo_renovacao: null };
    expect(statusLicenca({ ...base, data_validade: "2027-03-01" }, HOJE).rotulo).toBe("Renovação atrasada");
    expect(statusLicenca({ ...base, data_validade: "2028-01-01" }, HOJE).rotulo).toBe("Vigente");
    expect(statusLicenca({ ...base, data_validade: "2026-11-01" }, HOJE).rotulo).toBe("Vencida");
    expect(statusLicenca({ ...base, situacao: "em_renovacao" as const, data_validade: "2026-11-01" }, HOJE).rotulo).toBe("Em renovação");
  });
});

describe("condicionantes", () => {
  it("status e avanço de prazo periódico", () => {
    expect(statusCondicionante({ prazo: "2026-11-10", situacao: "pendente", tipo: "unica" }, HOJE).rotulo).toBe("Atrasada");
    expect(statusCondicionante({ prazo: "2026-11-10", situacao: "cumprida", tipo: "unica" }, HOJE).rotulo).toBe("Cumprida");
    expect(avancarPrazo("2026-01-31", 1)).toBe("2026-02-28");
    expect(avancarPrazo("2026-06-30", 12)).toBe("2027-06-30");
  });
});

describe("distribuir", () => {
  it("admin e extras recebem tudo; editor só o que é dele", () => {
    const sel = selecionarAlertas([item("a", "2026-11-20", "u-editor"), item("b", "2026-11-21", null)], MARCOS, new Set(), HOJE);
    const m = distribuir(
      sel,
      [
        { user_id: "u-admin", email: "Admin@x.com", papel: "admin", receber_alertas: true },
        { user_id: "u-editor", email: "ed@x.com", papel: "editor", receber_alertas: true },
        { user_id: "u-off", email: "off@x.com", papel: "admin", receber_alertas: false },
      ],
      ["cliente@y.com", "admin@x.com"],
    );
    expect(m.get("admin@x.com")?.length).toBe(2);
    expect(m.get("ed@x.com")?.map((i) => i.id)).toEqual(["a"]);
    expect(m.get("cliente@y.com")?.length).toBe(2);
    expect(m.has("off@x.com")).toBe(false);
  });
});

describe("licença vencida", () => {
  it("não gera alerta de renovação depois do vencimento", () => {
    const l: LinhaLicenca = { id: "x", tipo: "LO", numero: null, data_validade: "2026-11-01", antecedencia_renovacao_dias: 120, situacao: "ativa", protocolo_renovacao: null, responsavel_id: null, empreendimentos: null };
    expect(itensDeLicencas([l], HOJE).map((i) => i.entidade)).toEqual(["licenca"]);
  });
});
