import "server-only";
import { Resend } from "resend";
import type { ItemSelecionado } from "./alertas";
import { fmtData, fmtDias } from "./prazos";

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ROTULO_ENTIDADE: Record<string, string> = {
  licenca: "Validade",
  renovacao: "Renovação",
  condicionante: "Condicionante",
};

function cor(dias: number) {
  if (dias < 0) return "#b91c1c";
  if (dias <= 15) return "#c2410c";
  if (dias <= 45) return "#a16207";
  return "#047857";
}

function secao(titulo: string, itens: ItemSelecionado[]) {
  if (itens.length === 0) return "";
  const linhas = itens
    .map(
      (i) => `
      <tr>
        <td width="110" style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;background:#f1f5f9;color:#334155">${ROTULO_ENTIDADE[i.entidade]}</span>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top">
          <a href="${APP_URL()}/licencas/${i.licencaId}" style="color:#0f172a;font-weight:600;text-decoration:none">${esc(i.titulo)}</a>
          <div style="color:#475569;font-size:13px;margin-top:2px">${esc(i.detalhe.length > 220 ? i.detalhe.slice(0, 217) + "…" : i.detalhe)}</div>
          ${i.empresa ? `<div style="color:#94a3b8;font-size:12px;margin-top:2px">${esc(i.empresa)}</div>` : ""}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;white-space:nowrap">
          <div style="font-weight:600;color:${cor(i.dias)}">${fmtDias(i.dias)}</div>
          <div style="color:#64748b;font-size:12px">${fmtData(i.dataReferencia)}</div>
        </td>
      </tr>`,
    )
    .join("");
  return `
    <h3 style="margin:24px 0 8px;font-size:15px;color:#0f172a">${titulo} (${itens.length})</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">${linhas}</table>`;
}

export function montarEmailAlertas(orgNome: string, itens: ItemSelecionado[]) {
  const vencidos = itens.filter((i) => i.dias < 0);
  const semana = itens.filter((i) => i.dias >= 0 && i.dias <= 7);
  const proximos = itens.filter((i) => i.dias > 7);

  const partes = [
    vencidos.length && `${vencidos.length} vencido(s)`,
    semana.length && `${semana.length} nos próximos 7 dias`,
    proximos.length && `${proximos.length} se aproximando`,
  ].filter(Boolean);

  const assunto = `[Licenças] ${partes.join(", ")} — ${orgNome}`;

  const html = `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:680px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px"><img src="${APP_URL()}/logo-email.png" width="36" height="36" alt="" style="display:block;border-radius:8px"></td>
        <td style="font-size:13px;color:#047857;font-weight:600;letter-spacing:.02em">LICENÇAS AMBIENTAIS</td>
      </tr></table>
      <h2 style="margin:6px 0 4px;font-size:20px;color:#0f172a">Prazos que precisam da sua atenção</h2>
      <p style="margin:0;color:#475569;font-size:14px">${esc(orgNome)} · ${partes.join(" · ")}</p>
      ${secao("Vencidos", vencidos)}
      ${secao("Próximos 7 dias", semana)}
      ${secao("Se aproximando", proximos)}
      <div style="margin-top:28px">
        <a href="${APP_URL()}/dashboard" style="background:#047857;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Abrir painel</a>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px">
      Você recebe este aviso porque está cadastrado nos alertas da organização.
      Ajuste em <a href="${APP_URL()}/configuracoes" style="color:#64748b">Configurações</a>.
    </p>
  </div>
</body></html>`;

  const texto = itens
    .map((i) => `- [${ROTULO_ENTIDADE[i.entidade]}] ${i.titulo} — ${i.detalhe} — ${fmtDias(i.dias)} (${fmtData(i.dataReferencia)})`)
    .join("\n");

  return { assunto, html, texto: `Prazos que precisam da sua atenção (${orgNome}):\n\n${texto}\n\n${APP_URL()}/dashboard` };
}

export async function enviarEmail(para: string, assunto: string, html: string, texto: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurada");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Licenças <onboarding@resend.dev>",
    to: para,
    subject: assunto,
    html,
    text: texto,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
