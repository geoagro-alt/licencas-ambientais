import { NextResponse, type NextRequest } from "next/server";
import { getContexto } from "@/lib/contexto";
import { listarCondicionantes, listarLicencas, listarMembros, nomeMembro } from "@/lib/dados";
import { fmtData, limiteRenovacao, statusCondicionante, statusLicenca } from "@/lib/prazos";

/** Relatório em CSV (abre direto no Excel — separador ";" e BOM UTF-8). */
export async function GET(req: NextRequest) {
  const ctx = await getContexto();
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "licencas";
  const membros = await listarMembros(ctx.orgId);
  let linhas: (string | number | null | undefined)[][] = [];

  if (tipo === "condicionantes") {
    const conds = await listarCondicionantes(ctx.orgId);
    linhas = [
      ["Empresa", "Empreendimento", "Licença", "Nº licença", "Nº cond.", "Descrição", "Tipo", "Periodicidade (meses)", "Prazo", "Situação", "Status", "Responsável"],
      ...conds.map((c) => [
        c.licencas?.empreendimentos?.empresas?.razao_social,
        c.licencas?.empreendimentos?.nome,
        c.licencas?.tipo,
        c.licencas?.numero,
        c.numero,
        c.descricao,
        c.tipo,
        c.periodicidade_meses,
        fmtData(c.prazo),
        c.situacao,
        statusCondicionante(c).rotulo,
        nomeMembro(membros, c.responsavel_id ?? c.licencas?.responsavel_id ?? null),
      ]),
    ];
  } else {
    const lics = await listarLicencas(ctx.orgId);
    linhas = [
      ["Empresa", "Empreendimento", "Município", "UF", "Tipo", "Número", "Órgão", "Processo", "Emissão", "Validade", "Protocolar renovação até", "Protocolo renovação", "Situação", "Status", "Responsável"],
      ...lics.map((l) => [
        l.empreendimentos?.empresas?.razao_social,
        l.empreendimentos?.nome,
        l.empreendimentos?.municipio,
        l.empreendimentos?.uf,
        l.tipo,
        l.numero,
        l.orgao,
        l.processo,
        fmtData(l.data_emissao),
        fmtData(l.data_validade),
        fmtData(limiteRenovacao(l)),
        l.protocolo_renovacao,
        l.situacao,
        statusLicenca(l).rotulo,
        nomeMembro(membros, l.responsavel_id),
      ]),
    ];
  }

  const csv =
    "﻿" +
    linhas
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`).join(";"))
      .join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
