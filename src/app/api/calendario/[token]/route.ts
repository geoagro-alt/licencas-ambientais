import { createAdminClient } from "@/lib/supabase/admin";
import { buscarTudo } from "@/lib/paginacao";
import { limiteRenovacao } from "@/lib/prazos";
import { tituloLicenca, type LinhaLicenca } from "@/lib/alertas";

export const dynamic = "force-dynamic";

/**
 * Feed iCalendar (.ics) com todos os prazos da organização.
 * Assine no Google Agenda / Outlook: "Adicionar agenda > Por URL" com
 * https://SEU-APP/api/calendario/<token>.ics  (o token fica em Configurações).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/calendario/[token]">) {
  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/, "");
  const db = createAdminClient();

  const { data: org } = await db.from("organizacoes").select("id, nome").eq("ics_token", token).maybeSingle();
  if (!org) return new Response("Não encontrado", { status: 404 });

  const sel =
    "id, tipo, numero, data_validade, antecedencia_renovacao_dias, situacao, protocolo_renovacao, responsavel_id, empreendimentos(nome, empresas(razao_social))";
  const [licencas, conds] = await Promise.all([
    buscarTudo((de, ate) => db.from("licencas").select(sel).eq("org_id", org.id).neq("situacao", "encerrada").order("id").range(de, ate)),
    buscarTudo((de, ate) =>
      db
        .from("condicionantes")
        .select(`id, licenca_id, numero, descricao, prazo, situacao, licencas(${sel})`)
        .eq("org_id", org.id)
        .in("situacao", ["pendente", "em_andamento"])
        .not("prazo", "is", null)
        .order("id")
        .range(de, ate),
    ),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const eventos: string[] = [];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

  const evento = (uid: string, data: string, titulo: string, desc: string, url: string) => {
    const d = data.replace(/-/g, "");
    eventos.push(
      [
        "BEGIN:VEVENT",
        `UID:${uid}@licencas`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${d}`,
        `SUMMARY:${icsEsc(titulo)}`,
        `DESCRIPTION:${icsEsc(desc)}`,
        `URL:${url}`,
        "BEGIN:VALARM",
        "TRIGGER:-P7D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEsc(titulo)}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n"),
    );
  };

  for (const l of licencas as unknown as LinhaLicenca[]) {
    if (!l.data_validade) continue;
    const t = tituloLicenca(l);
    evento(`val-${l.id}`, l.data_validade, `Vence: ${t}`, l.empreendimentos?.empresas?.razao_social ?? "", `${appUrl}/licencas/${l.id}`);
    const lim = limiteRenovacao(l);
    if (lim && l.situacao === "ativa" && !l.protocolo_renovacao) {
      evento(`ren-${l.id}`, lim, `Protocolar renovação: ${t}`, "Prazo de antecedência para requerer a renovação", `${appUrl}/licencas/${l.id}`);
    }
  }
  for (const c of conds as unknown as (LinhaLicenca & { licenca_id: string; numero: string | null; descricao: string; prazo: string; licencas: LinhaLicenca | null })[]) {
    // mesma regra dos alertas: condicionantes de licença encerrada não entram
    if (!c.prazo || c.licencas?.situacao === "encerrada") continue;
    const t = c.licencas ? tituloLicenca(c.licencas) : "";
    evento(`cond-${c.id}-${c.prazo}`, c.prazo, `Condicionante ${c.numero ?? ""} — ${t}`.replace("  ", " "), c.descricao, `${appUrl}/licencas/${c.licenca_id}`);
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Licencas Ambientais//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEsc(`Licenças — ${org.nome}`)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    ...eventos,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  });
}

function icsEsc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n").slice(0, 900);
}
