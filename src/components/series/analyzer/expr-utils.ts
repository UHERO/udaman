/** Conversions between the eval syntax the server executes
 *  (`"VIS@HI.Q".ts / "CPI@US.Q".ts`) and the friendlier form typed into the
 *  analyzer's expression inputs (`VIS@HI.Q / CPI@US.Q`).
 *
 *  The two directions are inverses, so editing an entry round-trips: what you
 *  type is what you see the next time the input is rendered. */

/** Bare series name: PREFIX@GEO.FREQ, optionally with a vintage qualifier
 *  (`CPI&25Q1FF@US.Q`). */
const BARE_NAME_RE = /[%$\w]+(?:&[0-9Q]+[FH](?:\d+|F))?@\w+\.[ASQMWD]\b/gi;

/** Quoted series reference in eval syntax: `"PREFIX@GEO.FREQ".ts` / `.tsn` */
const QUOTED_REF_RE =
  /"([%$\w]+(?:&[0-9Q]+[FH](?:\d+|F))?@\w+\.[ASQMWD])"(\.tsn?)\b/gi;

/**
 * Drop a lone unpaired `"`.
 *
 * Eval syntax only ever uses quotes in pairs, so an odd count means the text is
 * malformed — a stray quote typed into an expression input, or the tail of a
 * reference that only partly converted back. Left in place it becomes a
 * permanent part of the entry's display name (`VLOSNS@KAU.M"`) and rides along
 * into the chart legend, the table header, the CSV export, and any entry
 * duplicated from it. Balanced expressions are returned untouched.
 */
function dropUnpairedQuote(s: string): string {
  const count = s.match(/"/g)?.length ?? 0;
  if (count % 2 === 0) return s;
  if (s.endsWith('"')) return s.slice(0, -1);
  if (s.startsWith('"')) return s.slice(1);
  return s.replace('"', "");
}

/**
 * Eval syntax → editable text.
 * `"VIS@HI.Q".ts` → `VIS@HI.Q`; `"A@HI.Q".ts / "B@US.Q".ts` → `A@HI.Q / B@US.Q`.
 * `.tsn` is kept because nullable loading is not the same as `.ts`.
 * Anything that isn't a plain series reference (method calls, string args,
 * `Series.` statics) is left untouched.
 */
export function exprToEditable(expr: string): string {
  // Whole expression is a single reference — un-quote it even if the name
  // doesn't carry a frequency suffix (`"EMPL@HAW".ts`, used by some loaders).
  const lone = expr.match(/^"([^"]+)"(\.tsn?)$/);
  if (lone) return lone[2] === ".tsn" ? `${lone[1]}.tsn` : lone[1];

  const unquoted = expr.replace(
    QUOTED_REF_RE,
    (_m, name: string, suffix: string) =>
      suffix.toLowerCase() === ".tsn" ? `${name}.tsn` : name,
  );
  // A partial conversion can leave a dangling quote behind (`"A@HI.M".ts"` →
  // `A@HI.M"`); don't let it reach the label.
  return dropUnpairedQuote(unquoted);
}

/**
 * Editable text → eval syntax.
 * Each bare series name is quoted individually and given a `.ts` suffix, so
 * `VIS@HI.Q / CPI@US.Q` becomes `"VIS@HI.Q".ts / "CPI@US.Q".ts` rather than
 * being quoted whole as one (nonexistent) series name.
 */
export function editableToExpr(input: string): string {
  // A stray unpaired quote is a typo, not eval syntax. Strip it first so it
  // can't satisfy the pass-through below and be stored as the expression.
  const cleaned = dropUnpairedQuote(input);

  // Already written in eval syntax — pass through untouched.
  if (cleaned.includes('"')) return cleaned;

  let matched = false;
  const converted = cleaned.replace(
    BARE_NAME_RE,
    (name: string, offset: number) => {
      // Preceded by a name character — this is the tail of a longer token
      // (an unrecognized vintage qualifier, say). Leave it alone.
      const prev = offset > 0 ? cleaned[offset - 1] : "";
      if (prev && /[%$\w&]/.test(prev)) return name;
      matched = true;
      // Respect a suffix the user typed themselves (`VIS@HI.Q.tsn.yoy`).
      const rest = cleaned.slice(offset + name.length);
      return /^\.tsn?\b/.test(rest) ? `"${name}"` : `"${name}".ts`;
    },
  );
  if (matched) return converted;

  // Nothing that looks like a series name (e.g. a name with no frequency
  // suffix, like `EMPL@HAW`) — treat the whole input as one name.
  return `"${cleaned}".ts`;
}

/** Chart/table label for an expression: the same text the user typed. */
export function exprToDisplayName(expr: string): string {
  return exprToEditable(expr);
}
