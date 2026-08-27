export interface HhdbHomeExemptionAttrs {
  id?: number | null;
  tmk?: string | null;
  claimant_name?: string | null;
  tax_year?: number | null;
}

export class HhdbHomeExemption {
  id: number | null;
  tmk: string | null;
  claimantName: string | null;
  taxYear: number | null;

  constructor(attrs: HhdbHomeExemptionAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.claimantName = attrs.claimant_name ?? null;
    this.taxYear = attrs.tax_year != null ? Number(attrs.tax_year) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      claimantName: this.claimantName,
      taxYear: this.taxYear,
    };
  }
}

export type HhdbHomeExemptionJSON = ReturnType<HhdbHomeExemption["toJSON"]>;

export function hhdbHomeExemptionRowToJSON(
  attrs: HhdbHomeExemptionAttrs,
): HhdbHomeExemptionJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    claimantName: attrs.claimant_name ?? null,
    taxYear: attrs.tax_year != null ? Number(attrs.tax_year) : null,
  };
}
