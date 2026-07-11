import { NextRequest, NextResponse } from "next/server";
import { findCorpByCode } from "@/lib/corpCodes";
import { DartApiError, extractKeyAccounts, getCompanyFinancials, selectFsRows } from "@/lib/dart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompareRequestBody = { corp_codes?: unknown; end_year?: unknown };

function parseEndYear(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "auto") return undefined;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return undefined;
  return num;
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
  const endYear = parseEndYear(body.end_year);

  const companies: {
    corp_code: string;
    corp_name: string;
    base_year: number;
    key_accounts: ReturnType<typeof extractKeyAccounts>;
  }[] = [];
  const errors: { corp_code: string; corp_name: string; message: string }[] = [];

  try {
    const results = await Promise.all(
      (corpCodes as string[]).map(async (corpCode) => {
        const corp = findCorpByCode(corpCode);
        const corpName = corp?.corp_name ?? corpCode;
        const financials = await getCompanyFinancials(corpCode, endYear);
        return { corpCode, corpName, financials };
      })
    );

    for (const { corpCode, corpName, financials } of results) {
      if (!financials) {
        errors.push({
          corp_code: corpCode,
          corp_name: corpName,
          message: endYear
            ? `${endYear}년 기준 DART 사업보고서 재무정보가 없습니다.`
            : "이 회사는 DART 사업보고서 재무정보가 없습니다.",
        });
        continue;
      }
      const fsRows = selectFsRows(financials.rows);
      companies.push({
        corp_code: corpCode,
        corp_name: corpName,
        base_year: financials.baseYear,
        key_accounts: extractKeyAccounts(fsRows, financials.baseYear),
      });
    }
  } catch (err) {
    if (err instanceof DartApiError) {
      return NextResponse.json({ error: `DART API 호출에 실패했습니다: ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: "알 수 없는 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ companies, errors });
}
