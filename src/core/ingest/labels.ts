/**
 * Light normalization of dimension labels. The framework applies
 * normalizeLabel to every dimension value a parser emits; parsers strip
 * their own source's footnote markers (stripFootnotes is a helper for the
 * common forms), because a blind rule would damage labels like
 * "SUB-TOTAL 1".
 */

/**
 * NFC, typographic quotes and dashes → ASCII, whitespace collapsed and
 * trimmed. Never renames: the label stays the source's own.
 */
export function normalizeLabel(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u2018\u2019\u02bb\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip trailing footnote markers: "Fuel 6/", "TOTAL 1/, 7/",
 * "Tobacco ***", "Kauai (p)", "Hotel¹".
 */
export function stripFootnotes(s: string): string {
  return normalizeLabel(
    s
      .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+$/u, "")
      .replace(/(\s*\(\s*[a-z]\s*\))+$/i, "")
      .replace(/(\s*(\d+\/,?|\*+))+$/, ""),
  );
}
