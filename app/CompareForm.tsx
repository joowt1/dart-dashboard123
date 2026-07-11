"use client";

import { useState } from "react";
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

export default function CompareForm() {
  const [selections, setSelections] = useState<(CorpCode | null)[]>([null, null, null]);
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
        body: JSON.stringify({ corp_codes: corpCodes }),
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
        body: JSON.stringify({ corp_codes: corpCodes }),
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">DART 재무제표 비교</h1>
      <p className="mb-8 text-sm text-gray-500">
        회사명으로 검색해 3개 회사를 선택하면 최근 3개년 재무제표 핵심 계정을 비교합니다.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {selections.map((sel, i) => (
          <CompanyAutocomplete
            key={i}
            label={`회사 ${i + 1}`}
            selected={sel}
            onSelect={(corp) => updateSelection(i, corp)}
          />
        ))}
      </div>

      <div className="mb-8 flex gap-3">
        <button
          type="button"
          disabled={!allSelected || status === "loading"}
          onClick={handleCompare}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "loading" ? "비교 중..." : "비교하기"}
        </button>
        {canDownload && (
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownload}
            className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDownloading ? "다운로드 중..." : "엑셀 다운로드"}
          </button>
        )}
      </div>

      {status === "error" && errorMessage && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {result && result.errors.length > 0 && (
        <div className="mb-6 space-y-2">
          {result.errors.map((e) => (
            <div
              key={e.corp_code}
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
              {e.corp_name}: {e.message}
            </div>
          ))}
        </div>
      )}

      {result && result.companies.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left dark:border-gray-700 dark:bg-gray-800">
                  계정명
                </th>
                {result.companies.map((c) => (
                  <th
                    key={c.corp_code}
                    colSpan={3}
                    className="border border-gray-300 bg-gray-100 px-3 py-2 text-center dark:border-gray-700 dark:bg-gray-800"
                  >
                    {c.corp_name}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="border border-gray-300 dark:border-gray-700" />
                {result.companies.map((c) =>
                  c.key_accounts[0]?.values.map((v) => (
                    <th
                      key={`${c.corp_code}-${v.year}`}
                      className="border border-gray-300 px-3 py-1 text-center font-normal text-gray-500 dark:border-gray-700"
                    >
                      {v.year}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {result.companies[0]?.key_accounts.map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="border border-gray-300 px-3 py-2 font-medium dark:border-gray-700">
                    {result.companies[0].key_accounts[rowIndex].label}
                  </td>
                  {result.companies.map((c) =>
                    c.key_accounts[rowIndex].values.map((v) => (
                      <td
                        key={`${c.corp_code}-${v.year}`}
                        className="border border-gray-300 px-3 py-2 text-right tabular-nums dark:border-gray-700"
                      >
                        {formatAmount(v.amount)}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
