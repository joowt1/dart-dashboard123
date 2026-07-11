import ExcelJS from "exceljs";
import { DartFnlttRow, KEY_ACCOUNT_RULES, buildYearLabels, normalizeAccountName, parseAmount } from "@/lib/dart";

export type CompanyFinancials = {
  name: string;
  baseYear: number;
  rows: DartFnlttRow[];
};

const HEADER_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 13 };
const THIN_SIDE: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFCCCCCC" } };
const THIN_BORDER: Partial<ExcelJS.Borders> = { top: THIN_SIDE, left: THIN_SIDE, bottom: THIN_SIDE, right: THIN_SIDE };
const NUM_FORMAT = "#,##0";

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, "_").slice(0, 31);
}

function autofit(ws: ExcelJS.Worksheet, minWidth = 10, maxWidth = 40) {
  const widths = new Map<number, number>();
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value == null) return;
      const len = String(cell.value).length;
      const col = cell.fullAddress.col;
      widths.set(col, Math.max(widths.get(col) ?? 0, len));
    });
  });
  widths.forEach((len, col) => {
    ws.getColumn(col).width = Math.min(Math.max(len + 2, minWidth), maxWidth);
  });
}

const FS_LABEL: Record<string, string> = { BS: "재무상태표", IS: "손익계산서", CIS: "포괄손익계산서" };

function writeCompanySheet(wb: ExcelJS.Workbook, companyName: string, baseYear: number, rows: DartFnlttRow[]) {
  const ws = wb.addWorksheet(sanitizeSheetName(companyName));

  ws.getCell("A1").value = `${companyName} - 재무제표 주요계정 (${baseYear - 2}~${baseYear})`;
  ws.getCell("A1").font = TITLE_FONT;
  ws.mergeCells("A1:E1");

  ws.addRow([]);
  const headerRow = ws.addRow(["구분(재무제표)", "계정명", String(baseYear - 2), String(baseYear - 1), String(baseYear)]);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: "center" };
  });
  const headerRowNumber = headerRow.number;

  for (const r of rows) {
    const sj = FS_LABEL[r.sj_div] ?? r.sj_div;
    const row = ws.addRow([
      sj,
      r.account_nm,
      parseAmount(r.bfefrmtrm_amount),
      parseAmount(r.frmtrm_amount),
      parseAmount(r.thstrm_amount),
    ]);
    ["C", "D", "E"].forEach((col) => {
      row.getCell(col).numFmt = NUM_FORMAT;
    });
  }

  for (let rowNum = headerRowNumber; rowNum <= ws.rowCount; rowNum++) {
    for (let colNum = 1; colNum <= 5; colNum++) {
      ws.getCell(rowNum, colNum).border = THIN_BORDER;
    }
  }

  ws.views = [{ state: "frozen", ySplit: headerRowNumber }];
  autofit(ws);
}

function writeComparisonSheet(wb: ExcelJS.Workbook, companies: CompanyFinancials[]) {
  // buildComparisonWorkbook에서 항상 회사별 시트보다 먼저 호출하므로 "비교" 시트가 자연히 첫 번째가 된다.
  const ws = wb.addWorksheet("비교");

  ws.getCell("A1").value = "3개년 재무제표 비교 (핵심 계정, 단위: 원)";
  ws.getCell("A1").font = TITLE_FONT;

  ws.addRow([]);
  const header1: (string | null)[] = ["계정명"];
  const header2: (string | null)[] = [""];
  for (const c of companies) {
    header1.push(c.name, null, null);
    header2.push(String(c.baseYear - 2), String(c.baseYear - 1), String(c.baseYear));
  }
  const h1 = ws.addRow(header1);
  const h2 = ws.addRow(header2);

  for (let i = 0; i < companies.length; i++) {
    const col = 2 + i * 3;
    ws.mergeCells(h1.number, col, h1.number, col + 2);
  }
  [h1, h2].forEach((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: "center" };
    });
  });

  const lookups = companies.map(({ baseYear, rows }) => {
    const yearMap = buildYearLabels(baseYear);
    const byLabel = new Map<string, Map<number, number>>();
    for (const r of rows) {
      const normalized = normalizeAccountName(r.account_nm);
      const rule = KEY_ACCOUNT_RULES.find((rule) => rule.test(normalized));
      if (!rule) continue;
      const entry = byLabel.get(rule.label) ?? new Map<number, number>();
      (Object.keys(yearMap) as (keyof typeof yearMap)[]).forEach((field) => {
        const amount = parseAmount(r[field]);
        if (amount !== null) entry.set(yearMap[field], amount);
      });
      byLabel.set(rule.label, entry);
    }
    return { baseYear, byLabel };
  });

  for (const { label } of KEY_ACCOUNT_RULES) {
    const rowValues: (string | number | null)[] = [label];
    for (const { baseYear, byLabel } of lookups) {
      const entry = byLabel.get(label) ?? new Map<number, number>();
      for (const offset of [2, 1, 0]) {
        rowValues.push(entry.get(baseYear - offset) ?? null);
      }
    }
    const row = ws.addRow(rowValues);
    for (let c = 2; c <= rowValues.length; c++) {
      row.getCell(c).numFmt = NUM_FORMAT;
    }
  }

  const lastCol = 1 + 3 * companies.length;
  for (let rowNum = h1.number; rowNum <= ws.rowCount; rowNum++) {
    for (let colNum = 1; colNum <= lastCol; colNum++) {
      ws.getCell(rowNum, colNum).border = THIN_BORDER;
    }
  }

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: h2.number }];
  autofit(ws);
}

export async function buildComparisonWorkbook(companies: CompanyFinancials[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  writeComparisonSheet(wb, companies);
  for (const c of companies) {
    writeCompanySheet(wb, c.name, c.baseYear, c.rows);
  }
  return wb;
}

export async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
