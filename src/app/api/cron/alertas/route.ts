import { NextResponse, type NextRequest } from "next/server";
import { executarAlertas } from "@/lib/executar-alertas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Disparado diariamente pelo Vercel Cron (ver vercel.json).
 * A Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente.
 * Pode ser chamado por qualquer agendador externo (cron-job.org, GitHub Actions) com o mesmo header.
 * `?dry=1` só simula (não envia nem registra).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  try {
    const resultado = await executarAlertas({ dryRun });
    return NextResponse.json({ ok: true, dryRun, resultado });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
