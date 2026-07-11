"use client";

import { useEffect, useRef, useState } from "react";
import type { CorpCode } from "@/lib/corpCodes";

type Props = {
  label: string;
  selected: CorpCode | null;
  onSelect: (corp: CorpCode | null) => void;
};

export default function CompanyAutocomplete({ label, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CorpCode[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (selected) return; // 이미 선택된 상태면 검색하지 않음
    const trimmed = query.trim();
    if (trimmed.length < 1) return;

    const currentRequestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (currentRequestId !== requestIdRef.current) return; // 오래된 응답 무시
        setResults(data.results ?? []);
        setTruncated(Boolean(data.truncated));
        setIsOpen(true);
      } catch {
        if (currentRequestId !== requestIdRef.current) return;
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selected]);

  function handlePick(corp: CorpCode) {
    onSelect(corp);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  }

  function handleClear() {
    onSelect(null);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <span>
            {selected.corp_name}{" "}
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({selected.stock_code || "비상장"})
            </span>
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            변경
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            if (value.trim().length < 1) {
              setResults([]);
              setIsOpen(false);
            }
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="회사명 입력"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      )}

      {isOpen && !selected && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">검색 결과가 없습니다.</div>
          ) : (
            <>
              {results.map((corp) => (
                <button
                  key={corp.corp_code}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(corp)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-slate-900 hover:bg-indigo-50 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <span>{corp.corp_name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{corp.stock_code || "비상장"}</span>
                </button>
              ))}
              {truncated && (
                <div className="px-3 py-2 text-xs text-slate-400">더 정확히 입력하면 더 나은 결과가 나옵니다.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
