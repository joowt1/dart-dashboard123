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
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {selected ? (
        <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
          <span>
            {selected.corp_name}{" "}
            <span className="text-xs text-gray-500">
              ({selected.stock_code || "비상장"})
            </span>
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
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
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900"
        />
      )}

      {isOpen && !selected && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">검색 결과가 없습니다.</div>
          ) : (
            <>
              {results.map((corp) => (
                <button
                  key={corp.corp_code}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(corp)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-gray-700"
                >
                  <span>{corp.corp_name}</span>
                  <span className="text-xs text-gray-500">{corp.stock_code || "비상장"}</span>
                </button>
              ))}
              {truncated && (
                <div className="px-3 py-2 text-xs text-gray-400">더 정확히 입력하면 더 나은 결과가 나옵니다.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
