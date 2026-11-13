import { describe, expect, it } from "vitest";
import { buscarTudo } from "../src/lib/paginacao";
import { celulaCsv, destinoSeguro, escHtml } from "../src/lib/seguranca";

describe("destinoSeguro", () => {
  it("aceita caminhos internos", () => {
    expect(destinoSeguro("/licencas/123?x=1")).toBe("/licencas/123?x=1");
  });
  it("rejeita outros domínios", () => {
    expect(destinoSeguro("//evil.com")).toBe("/dashboard");
    expect(destinoSeguro("/\\evil.com")).toBe("/dashboard");
    expect(destinoSeguro("https://evil.com")).toBe("/dashboard");
    expect(destinoSeguro("")).toBe("/dashboard");
    expect(destinoSeguro(null)).toBe("/dashboard");
  });
});

describe("escHtml", () => {
  it("escapa marcação", () => {
    expect(escHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;");
  });
});

describe("celulaCsv", () => {
  it("neutraliza fórmulas", () => {
    expect(celulaCsv("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(celulaCsv("+55 65 9999")).toBe(`"'+55 65 9999"`);
    expect(celulaCsv("@cmd")).toBe(`"'@cmd"`);
  });
  it("mantém textos e números comuns", () => {
    expect(celulaCsv("Fazenda Boa Vista")).toBe(`"Fazenda Boa Vista"`);
    expect(celulaCsv(12)).toBe(`"12"`);
    expect(celulaCsv(null)).toBe(`""`);
    expect(celulaCsv("linha 1\nlinha 2")).toBe(`"linha 1 linha 2"`);
  });
});

describe("buscarTudo", () => {
  const fonte = Array.from({ length: 2500 }, (_, i) => i);
  const pagina = (de: number, ate: number) => Promise.resolve({ data: fonte.slice(de, ate + 1), error: null });

  it("percorre todas as páginas", async () => {
    expect(await buscarTudo(pagina)).toHaveLength(2500);
  });
  it("para quando o total é múltiplo exato da página", async () => {
    let chamadas = 0;
    const r = await buscarTudo((de, ate) => {
      chamadas++;
      return Promise.resolve({ data: fonte.slice(0, 2000).slice(de, ate + 1), error: null });
    });
    expect(r).toHaveLength(2000);
    expect(chamadas).toBe(3);
  });
  it("propaga erro", async () => {
    await expect(buscarTudo(() => Promise.resolve({ data: null, error: { message: "falhou" } }))).rejects.toThrow("falhou");
  });
});
