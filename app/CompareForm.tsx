"use client";

import { Fragment, useState } from "react";
import CompanyAutocomplete from "@/app/CompanyAutocomplete";
import type { CorpCode } from "@/lib/corpCodes";

type KeyAccount = {
  label: string;
  values: { year: number; amount: number | null }[];
};

type CompareCompany = {
  corp_code: string;
  corp_name: string;
  base_year: number;
  key_accounts: KeyAccount[];
};

type CompareError = { corp_code: string; corp_name: string; message: string };

type CompareResult = {
  companies: CompareCompany[];
  errors: CompareError[];
};

function formatAmount(amount: number | null): string {
  if (amount === null) return "-";
  return amount.toLocaleString("ko-KR");
}

const CURRENT_YEAR = new Date().getFullYear();
const SELECTABLE_END_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 - i);

// 회사별로 시각적으로 구분되는 accent 컬러 (최대 3개 회사)
// header: 회사명 헤더 셀, panel: 그 회사 칼럼 전체(연도행+데이터행)에 옅게 깔리는 배경, dot: 색상 점
const COMPANY_THEMES = [
  {
    header: "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-100 dark:border-indigo-800",
    panel: "bg-indigo-50/50 border-indigo-100 dark:bg-indigo-500/5 dark:border-indigo-900/50",
    dot: "bg-indigo-500",
  },
  {
    header: "bg-teal-50 text-teal-900 border-teal-200 dark:bg-teal-500/20 dark:text-teal-100 dark:border-teal-800",
    panel: "bg-teal-50/50 border-teal-100 dark:bg-teal-500/5 dark:border-teal-900/50",
    dot: "bg-teal-500",
  },
  {
    header: "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-800",
    panel: "bg-rose-50/50 border-rose-100 dark:bg-rose-500/5 dark:border-rose-900/50",
    dot: "bg-rose-500",
  },
];

export default function CompareForm() {
  const [selections, setSelections] = useState<(CorpCode | null)[]>([null, null, null]);
  const [endYear, setEndYear] = useState<string>("auto");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const allSelected = selections.every((s) => s !== null);

  function updateSelection(index: number, corp: CorpCode | null) {
    setSelections((prev) => {
      const next = [...prev];
      next[index] = corp;
      return next;
    });
    setResult(null);
    setStatus("idle");
  }

  async function handleCompare() {
    if (!allSelected) return;
    setStatus("loading");
    setErrorMessage(null);
    setResult(null);
    try {
      const corpCodes = selections.map((s) => s!.corp_code);
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corp_codes: corpCodes, end_year: endYear }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "비교 중 오류가 발생했습니다.");
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("success");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다.");
      setStatus("error");
    }
  }

  async function handleDownload() {
    if (!allSelected) return;
    setIsDownloading(true);
    try {
      const corpCodes = selections.map((s) => s!.corp_code);
      const res = await fetch("/api/compare/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corp_codes: corpCodes, end_year: endYear }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? "엑셀 생성 중 오류가 발생했습니다.");
        setStatus("error");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const filename = match ? decodeURIComponent(match[1]) : "재무제표비교.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("다운로드 중 오류가 발생했습니다.");
      setStatus("error");
    } finally {
      setIsDownloading(false);
    }
  }

  const canDownload = status === "success" && result !== null && result.errors.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            DART Open API
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            재무제표 비교
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            회사명으로 검색해 3개 회사를 선택하면 재무제표 핵심 계정을 비교합니다.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:p-8">
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {selections.map((sel, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COMPANY_THEMES[i].dot}`} />
                <div className="w-full">
                  <CompanyAutocomplete
                    label={`회사 ${i + 1}`}
                    selected={sel}
                    onSelect={(corp) => updateSelection(i, corp)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6 flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">기준 연도</span>
              <select
                value={endYear}
                onChange={(e) => {
                  setEndYear(e.target.value);
                  setResult(null);
                  setStatus("idle");
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="auto">자동 (최신 3개년)</option>
                {SELECTABLE_END_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y - 2}~{y}년
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!allSelected || status === "loading"}
              onClick={handleCompare}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "loading" ? "비교 중..." : "비교하기"}
            </button>
            {canDownload && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleDownload}
                className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDownloading ? "다운로드 중..." : "엑셀 다운로드"}
              </button>
            )}
          </div>
        </div>

        {status === "error" && errorMessage && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {result && result.errors.length > 0 && (
          <div className="mt-6 space-y-2">
            {result.errors.map((e) => (
              <div
                key={e.corp_code}
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
              >
                {e.corp_name}: {e.message}
              </div>
            ))}
          </div>
        )}

        {result && result.companies.length > 0 && (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    계정명
                  </th>
                  {result.companies.map((c, i) => (
                    <Fragment key={c.corp_code}>
                      {i > 0 && <th className="w-5 min-w-5" />}
                      <th
                        colSpan={3}
                        className={`rounded-t-lg border px-4 py-3 text-center font-semibold ${COMPANY_THEMES[i].header}`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${COMPANY_THEMES[i].dot}`} />
                          {c.corp_name}
                        </span>
                      </th>
                    </Fragment>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900" />
                  {result.companies.map((c, i) => (
                    <Fragment key={c.corp_code}>
                      {i > 0 && <th className="w-5 min-w-5" />}
                      {c.key_accounts[0]?.values.map((v) => (
                        <th
                          key={v.year}
                          className={`border-x border-b px-4 py-2 text-center text-xs font-normal text-slate-500 dark:text-slate-400 ${COMPANY_THEMES[i].panel}`}
                        >
                          {v.year}
                        </th>
                      ))}
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.companies[0]?.key_accounts.map((_, rowIndex) => (
                  <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-transparent dark:even:bg-slate-800/30">
                    <td className="sticky left-0 z-10 border-b border-slate-200 bg-inherit px-4 py-3 font-medium text-slate-800 dark:border-slate-800 dark:text-slate-100">
                      {result.companies[0].key_accounts[rowIndex].label}
                    </td>
                    {result.companies.map((c, i) => (
                      <Fragment key={c.corp_code}>
                        {i > 0 && <td className="w-5 min-w-5" />}
                        {c.key_accounts[rowIndex].values.map((v) => (
                          <td
                            key={v.year}
                            className={`border-x border-b px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200 ${COMPANY_THEMES[i].panel}`}
                          >
                            {formatAmount(v.amount)}
                          </td>
                        ))}
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
