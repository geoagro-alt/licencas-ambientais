import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { FERRAMENTA, PROMPT_SISTEMA, lerJsonGemini, normalizarExtracao, paraSchemaGemini, type DadosExtraidos } from "./extracao-ia";

/**
 * Provedores de IA para ler licenças:
 *  - "gemini" (Google) — tem plano gratuito. Variável GEMINI_API_KEY (crie em aistudio.google.com). Modelo: GEMINI_MODEL.
 *  - "claude" (Anthropic) — pago, não usa os dados para treino. Variável ANTHROPIC_API_KEY. Modelo: ANTHROPIC_MODEL.
 * Se as duas chaves existirem, usa o Gemini, a menos que IA_PROVEDOR=claude.
 */
export type Provedor = "gemini" | "claude";

export function provedorIA(): Provedor | null {
  const forcado = process.env.IA_PROVEDOR;
  if (forcado === "claude" && process.env.ANTHROPIC_API_KEY) return "claude";
  if (forcado === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

export const iaConfigurada = () => provedorIA() !== null;

/** Limite de tamanho do arquivo enviado (o Gemini aceita até ~20 MB por requisição com o arquivo embutido). */
export const limiteBytes = () => (provedorIA() === "gemini" ? 18 * 1024 * 1024 : 30 * 1024 * 1024);

export async function extrairLicenca(arquivoBase64: string, tipo: "pdf" | "imagem", mime: string): Promise<DadosExtraidos> {
  return provedorIA() === "claude" ? extrairComClaude(arquivoBase64, tipo, mime) : extrairComGemini(arquivoBase64, tipo, mime);
}

// ------------------------------------------------------------------ Gemini (Google)

const MODELOS_GEMINI = () =>
  [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash-lite"].filter((m, i, a) => a.indexOf(m) === i);

async function extrairComGemini(base64: string, tipo: "pdf" | "imagem", mime: string): Promise<DadosExtraidos> {
  const corpo = {
    systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: tipo === "pdf" ? "application/pdf" : mime, data: base64 } },
          { text: "Extraia os dados desta licença e responda somente com o JSON no formato pedido." },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: paraSchemaGemini(FERRAMENTA.input_schema),
      maxOutputTokens: 16000,
    },
  };

  let ultimoErro = "";
  // tenta o modelo principal; se estiver indisponível ou sem cota, cai para o Flash-Lite (cota separada)
  for (const modelo of MODELOS_GEMINI()) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(corpo),
    });
    const json = await r.json().catch(() => ({}));
    if (r.ok) {
      const texto: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      if (!texto) {
        const motivo = json?.promptFeedback?.blockReason || json?.candidates?.[0]?.finishReason || "resposta vazia";
        throw new Error(`A IA não conseguiu ler o documento (${motivo}). Tente o PDF original ou uma foto mais nítida.`);
      }
      return normalizarExtracao(lerJsonGemini(texto));
    }
    const msg: string = json?.error?.message ?? `HTTP ${r.status}`;
    ultimoErro = msg;
    if (r.status === 400 && /api key/i.test(msg)) throw new Error("A chave GEMINI_API_KEY é inválida. Confira a configuração na Vercel.");
    if (r.status === 403) throw new Error("A chave GEMINI_API_KEY não tem permissão para a API do Gemini.");
    if (r.status === 404 || r.status === 429 || r.status >= 500) continue; // modelo indisponível / cota / instabilidade
    throw new Error(`Gemini: ${msg}`);
  }
  if (/quota|rate|exhausted/i.test(ultimoErro)) {
    throw new Error("Limite diário gratuito do Gemini atingido. Tente de novo amanhã (ou configure uma chave paga).");
  }
  throw new Error(`Gemini indisponível no momento: ${ultimoErro}`);
}

// ------------------------------------------------------------------ Claude (Anthropic)

async function extrairComClaude(base64: string, tipo: "pdf" | "imagem", mime: string): Promise<DadosExtraidos> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const bloco: Anthropic.ContentBlockParam =
    tipo === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 } };

  const resposta = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    max_tokens: 16000,
    system: PROMPT_SISTEMA,
    tools: [FERRAMENTA as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: FERRAMENTA.name },
    messages: [{ role: "user", content: [bloco, { type: "text", text: "Extraia os dados desta licença usando a ferramenta registrar_licenca." }] }],
  });

  const uso = resposta.content.find((b) => b.type === "tool_use");
  if (!uso || uso.type !== "tool_use") throw new Error("A IA não conseguiu ler o documento. Tente uma imagem mais nítida ou o PDF original.");
  return normalizarExtracao(uso.input as Record<string, unknown>);
}
