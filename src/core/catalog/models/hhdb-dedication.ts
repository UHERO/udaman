export interface HhdbDedicationAttrs {
  id?: number | null;
  tmk?: string | null;
  tax_year?: number | null;
  number_of_dedications?: string | null;
}

export class HhdbDedication {
  id: number | null;
  tmk: string | null;
  taxYear: number | null;
  numberOfDedications: string | null;

  constructor(attrs: HhdbDedicationAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.taxYear = attrs.tax_year != null ? Number(attrs.tax_year) : null;
    this.numberOfDedications = attrs.number_of_dedications ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      taxYear: this.taxYear,
      numberOfDedications: this.numberOfDedications,
    };
  }
}

export type HhdbDedicationJSON = ReturnType<HhdbDedication["toJSON"]>;

export function hhdbDedicationRowToJSON(attrs: HhdbDedicationAttrs): HhdbDedicationJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    taxYear: attrs.tax_year != null ? Number(attrs.tax_year) : null,
    numberOfDedications: attrs.number_of_dedications ?? null,
  };
}
