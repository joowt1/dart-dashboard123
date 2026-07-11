import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CorpCode = {
  corp_code: string;
  corp_name: string;
  stock_code: string;
};

// 8.9MB 규모의 JSON을 정적 import(빌드 타임 번들링/타입추론 대상)로 두면
// 빌드 머신 사양이 작을 때 "Collecting page data" 단계가 죽는 문제가 있어
// 런타임에 한 번만 읽어 모듈 스코프에 캐시하는 방식으로 로드한다.
const corpCodesPath = join(process.cwd(), "data", "corp-codes.json");
const corpCodes: CorpCode[] = JSON.parse(readFileSync(corpCodesPath, "utf-8"));

const MAX_RESULTS = 20;

export function searchCompanies(keyword: string): { results: CorpCode[]; truncated: boolean } {
  const trimmed = keyword.trim();
  if (!trimmed) return { results: [], truncated: false };

  const exact = corpCodes.filter((c) => c.corp_name === trimmed);
  let matches: CorpCode[];

  if (exact.length > 0) {
    matches = [...exact].sort((a, b) => Number(a.stock_code === "") - Number(b.stock_code === ""));
  } else {
    matches = corpCodes
      .filter((c) => c.corp_name.includes(trimmed))
      .sort((a, b) => {
        const listedDiff = Number(a.stock_code === "") - Number(b.stock_code === "");
        if (listedDiff !== 0) return listedDiff;
        return a.corp_name.length - b.corp_name.length;
      });
  }

  return {
    results: matches.slice(0, MAX_RESULTS),
    truncated: matches.length > MAX_RESULTS,
  };
}

export function findCorpByCode(corpCode: string): CorpCode | undefined {
  return corpCodes.find((c) => c.corp_code === corpCode);
}
