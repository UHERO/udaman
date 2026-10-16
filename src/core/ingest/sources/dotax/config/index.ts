/**
 * Parsed DOTAX config: label rules (every DOTAX spelling → one item),
 * known issues (hand-checked DOTAX file errors) and the fixed labels
 * (item → the `source` label load statements use). The CSV text lives
 * next to this file; labels and known issues started as copies of the
 * rprocess originals and are maintained here now.
 */

import { createHash } from "node:crypto";

import { CANONICAL_CSV } from "./canonical";
import { KNOWN_ISSUES_CSV } from "./known-issues";
import { LABELS_CSV } from "./labels";

/** Minimal RFC 4180 CSV parser → array of header-keyed records. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v !== ""));
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
  );
}

export type LabelRule = {
  type: string;
  section: string;
  sub: string;
  pattern: RegExp;
  item: string;
};

export type KnownIssue = {
  type: string;
  /** One row per month (ranges are expanded) */
  month: string;
  check: string;
  /** Regex matched against the problem detail; "" = any */
  detail: string;
  action: "waive" | "accept" | string;
  note: string;
};

export function expandMonths(spec: string): string[] {
  const [a, b] = spec.split("..");
  const end = b ?? a;
  const out: string[] = [];
  let [y, m] = a.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

let labels: LabelRule[] | null = null;
let known: KnownIssue[] | null = null;

export function labelRules(): LabelRule[] {
  labels ??= parseCsvRecords(LABELS_CSV).map((r) => ({
    type: r.type,
    section: r.section,
    sub: r.sub || "*",
    pattern: new RegExp(r.pattern, "i"),
    item: r.item,
  }));
  return labels;
}

export function knownIssues(): KnownIssue[] {
  known ??= parseCsvRecords(KNOWN_ISSUES_CSV).flatMap((r) =>
    expandMonths(r.month).map((month) => ({
      type: r.type,
      month,
      check: r.check,
      detail: r.detail ?? "",
      action: r.action,
      note: r.note,
    })),
  );
  return known;
}

/** Changes whenever any config text changes (part of the parser version). */
export function configFingerprint(): string {
  return createHash("sha1")
    .update(LABELS_CSV)
    .update(KNOWN_ISSUES_CSV)
    .update(CANONICAL_CSV)
    .digest("hex")
    .slice(0, 12);
}
