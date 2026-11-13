import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { FERRAMENTA, PROMPT_SISTEMA, normalizarExtracao, type DadosExtraidos } from "./extracao-ia";

/** Modelo usado na leitura. Sonnet: bom equilíbrio entre precisão em documentos e custo (~US$ 0,05–0,15 por licença). */
export const MODELO_IA = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export const iaConfigurada = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * Envia o documento (PDF ou imagem, em base64) ao Claude e devolve os dados normalizados.
 * Força o uso da ferramenta `registrar_licenca`, então a resposta vem sempre em JSON estruturado.
 */
export async function extrairLicenca(arquivoBase64: string, tipo: "pdf" | "imagem", mime: string): Promise<DadosExtraidos> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const bloco: Anthropic.ContentBlockParam =
    tipo === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: arquivoBase64 } }
      : {
          type: "image",
          source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: arquivoBase64 },
        };

  const resposta = await client.messages.create({
    model: MODELO_IA,
    max_tokens: 16000,
    system: PROMPT_SISTEMA,
    tools: [FERRAMENTA as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: FERRAMENTA.name },
    messages: [
      {
        role: "user",
        content: [bloco, { type: "text", text: "Extraia os dados desta licença usando a ferramenta registrar_licenca." }],
      },
    ],
  });

  const uso = resposta.content.find((b) => b.type === "tool_use");
  if (!uso || uso.type !== "tool_use") throw new Error("A IA não conseguiu ler o documento. Tente uma imagem mais nítida ou o PDF original.");
  return normalizarExtracao(uso.input as Record<string, unknown>);
}
