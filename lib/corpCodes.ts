import corpCodesData from "@/data/corp-codes.json";

export type CorpCode = {
  corp_code: string;
  corp_name: string;
  stock_code: string;
};

const corpCodes = corpCodesData as CorpCode[];

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
