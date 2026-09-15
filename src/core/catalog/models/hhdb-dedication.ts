export interface HhdbDedicationAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  tax_year?: number | null;
  number_of_dedications?: string | null;
}

export class HhdbDedication {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  taxYear: number | null;
  numberOfDedications: string | null;

  constructor(attrs: HhdbDedicationAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.taxYear = attrs.tax_year != null ? Number(attrs.tax_year) : null;
    this.numberOfDedications = attrs.number_of_dedications ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      taxYear: this.taxYear,
      numberOfDedications: this.numberOfDedications,
    };
  }
}

export type HhdbDedicationJSON = ReturnType<HhdbDedication["toJSON"]>;

export function hhdbDedicationRowToJSON(
  attrs: HhdbDedicationAttrs,
): HhdbDedicationJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    scrapedAt: attrs.scraped_at
      ? new Date(attrs.scraped_at).toISOString()
      : null,
    taxYear: attrs.tax_year != null ? Number(attrs.tax_year) : null,
    numberOfDedications: attrs.number_of_dedications ?? null,
  };
}
