/** Funções puras de saneamento (sem I/O) — testadas em tests/seguranca.test.ts. */

/**
 * Destino de redirecionamento após login: só caminhos internos.
 * Rejeita "//site.com" e "/\site.com", que o navegador trata como outro domínio.
 */
export function destinoSeguro(next: string | null | undefined, padrao = "/dashboard"): string {
  if (!next || !next.startsWith("/")) return padrao;
  if (next.startsWith("//") || next.includes("\\") || /[\r\n\t]/.test(next)) return padrao;
  return next;
}

/** Escapa texto para uso dentro de HTML (e-mails). */
export function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Célula de CSV entre aspas. Textos que começam com = + - @ (ou tab/CR) recebem um apóstrofo na frente,
 * para o Excel não executá-los como fórmula.
 */
export function celulaCsv(v: string | number | null | undefined): string {
  let s = String(v ?? "").replace(/\r?\n/g, " ");
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const SENHA_MINIMA = 8;
