/**
 * Profile-page parser. Pure: HTML in, DccaProfile out (null for a
 * registration number the register does not know).
 *
 * The data is one <pre> block of "Label<spaces><em>value</em> <br>" lines —
 * a fixed set of 18 labels as of 2026-09 (see LABELS) — followed by a
 * "Condominium Filing Type" table linking the filed PDFs. A page for an
 * unknown number has no <pre> at all (the wrapper just says "zero").
 *
 * Every label the parser does not know lands in `extra`, so a field the
 * register adds later is visible in the run report instead of lost.
 */

import { parse } from "node-html-parser";

import { DCCA_BASE_URL, dccaProfileUrl } from "./config";
import {
  cleanText,
  decodeEntities,
  expandTmk,
  intOrNull,
  textOrNull,
} from "./text";
import {
  DccaParseError,
  type DccaFiling,
  type DccaProfile,
  type YesNo,
} from "./types";

/** Labels as printed, mapped to how their value is read. */
const LABELS = {
  "Registration Number": "reg",
  "Project Name": "name",
  "Project Address": "address",
  "Developer(s)": "developer",
  Zoning: "zoning",
  TMK: "tmk",
  Buildings: "buildings",
  Floors: "floors",
  "Total Units": "totalUnits",
  Residential: "residential",
  Commercial: "commercial",
  Agricultural: "agricultural",
  Parking: "parking",
  "Tool Sheds": "toolSheds",
  Other: "other",
  Ohana: "ohana",
  Converted: "converted",
  "Land Ownership": "landOwnership",
} as const;

type LabelKey = (typeof LABELS)[keyof typeof LABELS];

/** One "Label   <em>v</em>, <em>v</em> <br>" line → label + its <em> values. */
interface RawLine {
  label: string;
  values: string[];
}

function splitPreLines(preHtml: string): RawLine[] {
  const lines: RawLine[] = [];
  for (const chunk of preHtml.split(/<br\s*\/?>/i)) {
    // Drop the <h3> title and <hr> separators; keep only "Label  <em>…" lines.
    const body = chunk.replace(/<h3[\s\S]*?<\/h3>|<hr\s*\/?>/gi, "");
    const m = /^\s*([A-Za-z][A-Za-z()' ]*?)\s{2,}([\s\S]*)$/.exec(body);
    if (!m) continue;
    const label = cleanText(m[1]);
    const values = [...m[2].matchAll(/<em>([\s\S]*?)<\/em>/g)].map((em) =>
      cleanText(em[1]),
    );
    lines.push({ label, values });
  }
  return lines;
}

function yesNo(raw: string | undefined): YesNo | null {
  const s = cleanText(raw).toUpperCase();
  if (s === "YES" || s === "Y") return "Yes";
  if (s === "NO" || s === "N") return "No";
  return null;
}

function parseFilings(
  root: ReturnType<typeof parse>,
  reg: string,
): DccaFiling[] {
  const filings: DccaFiling[] = [];
  for (const tr of root.querySelectorAll("table#table1 tbody tr")) {
    const td = tr.querySelector("td.link");
    if (!td) continue;
    const a = td.querySelector("a[href]");
    const href = a?.getAttribute("href");
    if (!href) continue;
    const label = cleanText(td.querySelector("h5")?.textContent ?? "");
    const file = href.split("/").pop() ?? href;
    // Trailing text: "Initial &nbsp; • &nbsp; 6368B.pdf"
    const tail = cleanText(
      decodeEntities(td.innerHTML.replace(/<[^>]+>/g, " ")),
    ).replace(label, "");
    const kind = textOrNull(tail.split("•")[0]);
    filings.push({
      label: label || `filing ${reg}`,
      kind,
      file,
      url: new URL(href, DCCA_BASE_URL).toString(),
    });
  }
  return filings;
}

export function parseProfile(html: string, reg?: string): DccaProfile | null {
  const root = parse(html);
  const pre = root.querySelector("pre");
  if (!pre) {
    // An unknown registration number renders the wrapper with no <pre>.
    if (/<div id="wrapper">/.test(html)) return null;
    throw new DccaParseError("profile page has no <pre> block and no wrapper");
  }

  const fields: Partial<Record<LabelKey, string[]>> = {};
  const extra: Record<string, string> = {};
  for (const line of splitPreLines(pre.innerHTML)) {
    const key = (LABELS as Record<string, LabelKey>)[line.label];
    if (key) fields[key] = line.values;
    else extra[line.label] = line.values.join(", ");
  }

  const regOnPage = textOrNull(fields.reg?.[0]);
  const regNumber = regOnPage ?? reg ?? null;
  if (!regNumber) {
    throw new DccaParseError("profile page has no Registration Number");
  }
  if (reg && regOnPage && regOnPage !== reg) {
    throw new DccaParseError(
      `profile page says registration ${regOnPage}, expected ${reg}`,
    );
  }

  const name =
    textOrNull(fields.name?.[0]) ??
    textOrNull(root.querySelector("pre h3")?.textContent);
  if (!name) {
    throw new DccaParseError(`profile ${regNumber} has no Project Name`);
  }

  // Project Address prints four <em>s: street, city, state, zip — any may be empty.
  const [street, city, state, zip] = (fields.address ?? []).map(textOrNull);
  const address =
    [street, [city, state].filter(Boolean).join(", "), zip]
      .map((p) => p ?? "")
      .filter((p) => p !== "")
      .join(", ")
      .replace(/, (\d{5}(-\d{4})?)$/, " $1") || null;

  const int = (k: LabelKey) => intOrNull(fields[k]?.[0]);
  const tmkRaw = textOrNull(fields.tmk?.[0]);

  const profile: DccaProfile = {
    reg: regNumber,
    name,
    address,
    street: street ?? null,
    city: city ?? null,
    state: state ?? null,
    zip: zip ?? null,
    developer: textOrNull(fields.developer?.join("; ")),
    zoning: textOrNull(fields.zoning?.[0]),
    tmkRaw,
    tmk: expandTmk(tmkRaw),
    buildings: int("buildings"),
    floors: int("floors"),
    totalUnits: int("totalUnits"),
    residential: int("residential"),
    commercial: int("commercial"),
    agricultural: int("agricultural"),
    parking: int("parking"),
    toolSheds: int("toolSheds"),
    other: int("other"),
    ohana: yesNo(fields.ohana?.[0]),
    converted: yesNo(fields.converted?.[0]),
    landOwnership: textOrNull(fields.landOwnership?.[0])?.toUpperCase() ?? null,
    filings: parseFilings(root, regNumber),
    extra,
    url: dccaProfileUrl(regNumber),
  };
  return profile;
}
