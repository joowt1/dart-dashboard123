// DART Open API 클라이언트 + 재무제표 비교 로직
// 서버 전용 모듈 - "use client" 컴포넌트에서 import 금지 (DART_API_KEY 노출 방지)

export type DartFsDiv = "OFS" | "CFS";
export type DartSjDiv = "BS" | "IS" | "CIS";

export type DartFnlttRow = {
  fs_div: DartFsDiv;
  sj_div: DartSjDiv;
  account_nm: string;
  thstrm_amount: string;
  frmtrm_amount: string;
  bfefrmtrm_amount: string;
};

type DartFnlttResponse = {
  status: string;
  message?: string;
  list?: DartFnlttRow[];
};

export class DartApiError extends Error {}

export function getApiKey(): string {
  const key = process.env.DART_API_KEY;
  if (!key) {
    throw new DartApiError("서버에 DART_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }
  return key;
}

const REPRT_CODE_ANNUAL = "11011";

export function parseAmount(value: string | null | undefined): number | null {
  if (value == null) return null;
  let v = value.trim();
  if (v === "" || v === "-") return null;
  const negative = v.startsWith("(") && v.endsWith(")");
  if (negative) v = v.slice(1, -1);
  v = v.replace(/,/g, "");
  const num = Number(v);
  if (Number.isNaN(num)) return null;
  return negative ? -num : num;
}

export function normalizeAccountName(name: string): string {
  return name.replace(/\(.*?\)/g, "").replace(/\s/g, "").trim();
}

export const KEY_ACCOUNT_RULES: { label: string; test: (normalized: string) => boolean }[] = [
  { label: "매출액", test: (n) => n === "매출액" || n === "매출" },
  { label: "영업이익", test: (n) => n === "영업이익" || n === "영업손실" },
  { label: "법인세차감전순이익", test: (n) => n.includes("법인세") && n.includes("차감전") },
  { label: "당기순이익", test: (n) => n === "당기순이익" || n === "당기순손실" },
  { label: "자산총계", test: (n) => n === "자산총계" },
  { label: "부채총계", test: (n) => n === "부채총계" },
  { label: "자본총계", test: (n) => n === "자본총계" },
];

async function fetchFinancials(corpCode: string, bsnsYear: number): Promise<DartFnlttResponse> {
  const params = new URLSearchParams({
    crtfc_key: getApiKey(),
    corp_code: corpCode,
    bsns_year: String(bsnsYear),
    reprt_code: REPRT_CODE_ANNUAL,
  });
  const res = await fetch(`https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?${params.toString()}`);
  if (!res.ok) {
    throw new DartApiError(`DART API 호출 실패 (HTTP ${res.status})`);
  }
  return (await res.json()) as DartFnlttResponse;
}

export const MIN_SELECTABLE_YEAR_OFFSET = 1; // currentYear - 1 (가장 최신 사업보고서 연도)
export const MAX_SELECTABLE_YEAR_OFFSET = 6; // currentYear - 6까지 선택 가능

export function getSelectableEndYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let offset = MIN_SELECTABLE_YEAR_OFFSET; offset <= MAX_SELECTABLE_YEAR_OFFSET; offset++) {
    years.push(currentYear - offset);
  }
  return years;
}

/**
 * targetYear가 주어지면 그 연도(사업보고서 기준연도)만 조회한다 - 사용자가 직접 고른 연도이므로 폴백하지 않는다.
 * 주어지지 않으면 최신 연도부터 최대 4개년을 내려가며 데이터가 있는 첫 연도를 채택한다(자동 모드).
 */
export async function getCompanyFinancials(
  corpCode: string,
  targetYear?: number
): Promise<{ baseYear: number; rows: DartFnlttRow[] } | null> {
  if (targetYear !== undefined) {
    const data = await fetchFinancials(corpCode, targetYear);
    if (data.status === "000" && data.list && data.list.length > 0) {
      return { baseYear: targetYear, rows: data.list };
    }
    if (data.status !== "000" && data.status !== "013") {
      throw new DartApiError(data.message || `DART API 오류 (status ${data.status})`);
    }
    return null;
  }

  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 1; year >= currentYear - 4; year--) {
    const data = await fetchFinancials(corpCode, year);
    if (data.status === "000" && data.list && data.list.length > 0) {
      return { baseYear: year, rows: data.list };
    }
    if (data.status !== "000" && data.status !== "013") {
      // 013 = 조회된 데이터 없음(정상적인 없음), 그 외는 진짜 오류(인증키 오류 등)
      throw new DartApiError(data.message || `DART API 오류 (status ${data.status})`);
    }
  }
  return null;
}

export function selectFsRows(rows: DartFnlttRow[]): DartFnlttRow[] {
  const cfs = rows.filter((r) => r.fs_div === "CFS");
  return cfs.length > 0 ? cfs : rows.filter((r) => r.fs_div === "OFS");
}

export function buildYearLabels(baseYear: number): Record<"thstrm_amount" | "frmtrm_amount" | "bfefrmtrm_amount", number> {
  return {
    thstrm_amount: baseYear,
    frmtrm_amount: baseYear - 1,
    bfefrmtrm_amount: baseYear - 2,
  };
}

export type KeyAccountValues = { year: number; amount: number | null }[];

export function extractKeyAccounts(
  rows: DartFnlttRow[],
  baseYear: number
): { label: string; values: KeyAccountValues }[] {
  const yearMap = buildYearLabels(baseYear);
  const byLabel = new Map<string, Map<number, number>>();

  for (const row of rows) {
    const normalized = normalizeAccountName(row.account_nm);
    const rule = KEY_ACCOUNT_RULES.find((r) => r.test(normalized));
    if (!rule) continue;
    const entry = byLabel.get(rule.label) ?? new Map<number, number>();
    (Object.keys(yearMap) as (keyof typeof yearMap)[]).forEach((field) => {
      const amount = parseAmount(row[field]);
      if (amount !== null) entry.set(yearMap[field], amount);
    });
    byLabel.set(rule.label, entry);
  }

  return KEY_ACCOUNT_RULES.map(({ label }) => {
    const entry = byLabel.get(label) ?? new Map<number, number>();
    const values: KeyAccountValues = [2, 1, 0].map((offset) => {
      const year = baseYear - offset;
      return { year, amount: entry.get(year) ?? null };
    });
    return { label, values };
  });
}
