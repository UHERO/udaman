/**
 * Read a DOTAX spreadsheet the way the R parser saw it through
 * readxl::read_excel(col_names = FALSE, col_types = "text"): every cell as
 * text ("" for empty), whitespace squished, ’ → ', with leading and
 * trailing empty rows / columns trimmed (readxl reads the data rectangle).
 * Numbers become their plain decimal text; date-formatted cells their
 * formatted text (a header month typed as a date cell still reads
 * "Mar 2020").
 */

import { readFileSync } from "node:fs";

import XLSX from "xlsx";

export type Matrix = string[][];

const workbooks = new Map<string, XLSX.WorkBook>();
const WORKBOOK_CACHE_MAX = 4;

export function readWorkbook(path: string): XLSX.WorkBook {
  const hit = workbooks.get(path);
  if (hit) return hit;
  const buf = readFileSync(path);
  // readxl opens only real Excel files (OLE2 .xls, zip .xlsx). SheetJS also
  // reads Lotus and others, which the R parser recorded as unreadable
  // (e.g. the Lotus 04FUEL.xls in the 2002-04 archive); keep R's outcome.
  const ole2 = buf.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
  const zip = buf.subarray(0, 2).equals(Buffer.from([0x50, 0x4b]));
  if (!ole2 && !zip) throw new Error(`${path}: not an Excel workbook`);
  const wb = XLSX.read(buf, {
    type: "buffer",
    cellNF: true,
    cellDates: false,
    dense: false,
  });
  workbooks.set(path, wb);
  while (workbooks.size > WORKBOOK_CACHE_MAX) {
    workbooks.delete(workbooks.keys().next().value as string);
  }
  return wb;
}

export function sheetNames(path: string): string[] {
  return readWorkbook(path).SheetNames;
}

export function squish(s: string): string {
  return s.replace(/’/g, "'").replace(/\s+/g, " ").trim();
}

function cellText(c: XLSX.CellObject | undefined): string {
  if (!c || c.v === undefined || c.v === null) return "";
  switch (c.t) {
    case "n": {
      if (c.z && XLSX.SSF.is_date(c.z as string) && c.w) return c.w;
      return String(c.v);
    }
    case "s":
      return String(c.v);
    case "b":
      return c.v ? "TRUE" : "FALSE";
    case "d":
      return c.w ?? String(c.v);
    default:
      return ""; // errors (#N/A …) and stubs read as NA in readxl
  }
}

export function readMatrix(path: string, sheet: string): Matrix {
  const ws = readWorkbook(path).Sheets[sheet];
  if (!ws || !ws["!ref"]) return [];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const raw: Matrix = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      row.push(squish(cellText(ws[XLSX.utils.encode_cell({ r, c })])));
    }
    raw.push(row);
  }
  // Trim to the data rectangle.
  let top = 0;
  let bottom = raw.length - 1;
  while (top <= bottom && raw[top].every((v) => v === "")) top++;
  while (bottom >= top && raw[bottom].every((v) => v === "")) bottom--;
  if (top > bottom) return [];
  const rows = raw.slice(top, bottom + 1);
  const width = rows[0].length;
  let left = 0;
  let right = width - 1;
  while (left <= right && rows.every((r) => r[left] === "")) left++;
  while (right >= left && rows.every((r) => r[right] === "")) right--;
  return rows.map((r) => r.slice(left, right + 1));
}
