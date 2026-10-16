/**
 * Panel identity within a table, shared by the manifest and the matcher.
 *
 *  - Year panels ("2022 Population group", "2023 Population group", …) are
 *    the same series observed in different years: they share one identity
 *    (the first panel's index) and the label without the year.
 *  - Panels whose labels collide ("NAICS code" twice in 02.37) take a
 *    distinguishing label from the first column header that differs
 *    between them ("Kind of business subject to / exempt from federal
 *    income tax").
 */
import type { IRTable } from "./ir";
import { labelKey, splitPeriod } from "./labels";

export interface PanelIdentity {
  /** Panel index that represents this panel's series. */
  id: number;
  /** Label for naming/matching, without any period. */
  label: string;
}

export function panelIdentities(table: IRTable): Map<number, PanelIdentity> {
  const out = new Map<number, PanelIdentity>();
  const parsed = table.panels.map((p) => {
    const sp = p.label ? splitPeriod(p.label) : null;
    const dated =
      !!sp && sp.period.basis !== "unknown" && sp.period.basis !== "interval";
    return { panel: p, dated, residue: dated ? sp!.residue : p.label };
  });

  // Year panels with the same residue → one identity.
  const byResidue = new Map<string, typeof parsed>();
  for (const x of parsed) {
    if (!x.dated) continue;
    const k = labelKey(x.residue);
    byResidue.set(k, [...(byResidue.get(k) ?? []), x]);
  }
  for (const group of byResidue.values()) {
    if (group.length < 2) continue;
    const id = Math.min(...group.map((x) => x.panel.index));
    for (const x of group) out.set(x.panel.index, { id, label: x.residue });
  }

  // Remaining panels: own identity; disambiguate colliding labels by header.
  const rest = parsed.filter((x) => !out.has(x.panel.index));
  const byLabel = new Map<string, typeof parsed>();
  for (const x of rest) {
    const k = labelKey(x.panel.label);
    byLabel.set(k, [...(byLabel.get(k) ?? []), x]);
  }
  for (const group of byLabel.values()) {
    let labels = group.map((x) => x.panel.label);
    if (group.length > 1) {
      const cols = [
        ...new Set(group.flatMap((x) => Object.keys(x.panel.headers))),
      ].sort((a, b) => Number(a) - Number(b));
      for (const col of cols) {
        const texts = group.map((x) =>
          (x.panel.headers[Number(col)] ?? []).join(" "),
        );
        if (new Set(texts.map(labelKey)).size === group.length) {
          labels = texts;
          break;
        }
      }
    }
    group.forEach((x, i) =>
      out.set(x.panel.index, { id: x.panel.index, label: labels[i] }),
    );
  }
  return out;
}
