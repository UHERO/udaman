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

  return expr.replace(QUOTED_REF_RE, (_m, name: string, suffix: string) =>
    suffix.toLowerCase() === ".tsn" ? `${name}.tsn` : name,
  );
}

/**
 * Editable text → eval syntax.
 * Each bare series name is quoted individually and given a `.ts` suffix, so
 * `VIS@HI.Q / CPI@US.Q` becomes `"VIS@HI.Q".ts / "CPI@US.Q".ts` rather than
 * being quoted whole as one (nonexistent) series name.
 */
export function editableToExpr(input: string): string {
  // Already written in eval syntax — pass through untouched.
  if (input.includes('"')) return input;

  let matched = false;
  const converted = input.replace(
    BARE_NAME_RE,
    (name: string, offset: number) => {
      // Preceded by a name character — this is the tail of a longer token
      // (an unrecognized vintage qualifier, say). Leave it alone.
      const prev = offset > 0 ? input[offset - 1] : "";
      if (prev && /[%$\w&]/.test(prev)) return name;
      matched = true;
      // Respect a suffix the user typed themselves (`VIS@HI.Q.tsn.yoy`).
      const rest = input.slice(offset + name.length);
      return /^\.tsn?\b/.test(rest) ? `"${name}"` : `"${name}".ts`;
    },
  );
  if (matched) return converted;

  // Nothing that looks like a series name (e.g. a name with no frequency
  // suffix, like `EMPL@HAW`) — treat the whole input as one name.
  return `"${input}".ts`;
}

/** Chart/table label for an expression: the same text the user typed. */
export function exprToDisplayName(expr: string): string {
  return exprToEditable(expr);
}
