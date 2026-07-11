import { NextRequest, NextResponse } from "next/server";
import { findCorpByCode } from "@/lib/corpCodes";
import { DartApiError, getCompanyFinancials, selectFsRows } from "@/lib/dart";
import { buildComparisonWorkbook, workbookToBuffer, type CompanyFinancials } from "@/lib/excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompareRequestBody = { corp_codes?: unknown };

function sanitizeForFilename(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, "");
}

export async function POST(request: NextRequest) {
  let body: CompareRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const corpCodes = body.corp_codes;
  if (!Array.isArray(corpCodes) || corpCodes.length !== 3 || corpCodes.some((c) => typeof c !== "string" || !c)) {
    return NextResponse.json({ error: "3개 회사를 모두 선택해주세요." }, { status: 400 });
  }

  const companies: CompanyFinancials[] = [];

  try {
    const results = await Promise.all(
      (corpCodes as string[]).map(async (corpCode) => {
        const corp = findCorpByCode(corpCode);
        const corpName = corp?.corp_name ?? corpCode;
        const financials = await getCompanyFinancials(corpCode);
        return { corpCode, corpName, financials };
      })
    );

    for (const { corpCode, corpName, financials } of results) {
      if (!financials) {
        return NextResponse.json(
          { error: `'${corpName}'(${corpCode})은(는) DART 사업보고서 재무정보가 없습니다.` },
          { status: 422 }
        );
      }
      companies.push({
        name: corpName,
        baseYear: financials.baseYear,
        rows: selectFsRows(financials.rows),
      });
    }
  } catch (err) {
    if (err instanceof DartApiError) {
      return NextResponse.json({ error: `DART API 호출에 실패했습니다: ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: "알 수 없는 오류가 발생했습니다." }, { status: 500 });
  }

  const wb = await buildComparisonWorkbook(companies);
  const buffer = await workbookToBuffer(wb);

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  const rawName = `재무제표비교_${companies.map((c) => sanitizeForFilename(c.name)).join("_")}_${timestamp}.xlsx`;
  const encodedName = encodeURIComponent(rawName);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="download.xlsx"; filename*=UTF-8''${encodedName}`,
      "Content-Length": String(buffer.length),
    },
  });
}
