import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/corpCodes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ error: "검색어를 입력해주세요." }, { status: 400 });
  }

  const { results, truncated } = searchCompanies(q);
  return NextResponse.json({ query: q, results, truncated });
}
