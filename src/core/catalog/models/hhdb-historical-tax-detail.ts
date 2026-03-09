export interface HhdbHistoricalTaxDetailAttrs {
  id?: number | null;
  historical_tax_summary_id?: number | null;
  tmk?: string | null;
  tax_period?: string | null;
  description?: string | null;
  tax?: number | null;
  payments_credits?: number | null;
  penalty?: number | null;
  interest?: number | null;
  other?: number | null;
}

export class HhdbHistoricalTaxDetail {
  id: number | null;
  historicalTaxSummaryId: number | null;
  tmk: string | null;
  taxPeriod: string | null;
  description: string | null;
  tax: number | null;
  paymentsCredits: number | null;
  penalty: number | null;
  interest: number | null;
  other: number | null;

  constructor(attrs: HhdbHistoricalTaxDetailAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.historicalTaxSummaryId =
      attrs.historical_tax_summary_id != null
        ? Number(attrs.historical_tax_summary_id)
        : null;
    this.tmk = attrs.tmk ?? null;
    this.taxPeriod = attrs.tax_period ?? null;
    this.description = attrs.description ?? null;
    this.tax = attrs.tax != null ? Number(attrs.tax) : null;
    this.paymentsCredits =
      attrs.payments_credits != null ? Number(attrs.payments_credits) : null;
    this.penalty = attrs.penalty != null ? Number(attrs.penalty) : null;
    this.interest = attrs.interest != null ? Number(attrs.interest) : null;
    this.other = attrs.other != null ? Number(attrs.other) : null;
  }

  toJSON() {
    return {
      id: this.id,
      historicalTaxSummaryId: this.historicalTaxSummaryId,
      tmk: this.tmk,
      taxPeriod: this.taxPeriod,
      description: this.description,
      tax: this.tax,
      paymentsCredits: this.paymentsCredits,
      penalty: this.penalty,
      interest: this.interest,
      other: this.other,
    };
  }
}

export type HhdbHistoricalTaxDetailJSON = ReturnType<
  HhdbHistoricalTaxDetail["toJSON"]
>;

export function hhdbHistoricalTaxDetailRowToJSON(
  attrs: HhdbHistoricalTaxDetailAttrs,
): HhdbHistoricalTaxDetailJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    historicalTaxSummaryId:
      attrs.historical_tax_summary_id != null
        ? Number(attrs.historical_tax_summary_id)
        : null,
    tmk: attrs.tmk ?? null,
    taxPeriod: attrs.tax_period ?? null,
    description: attrs.description ?? null,
    tax: attrs.tax != null ? Number(attrs.tax) : null,
    paymentsCredits:
      attrs.payments_credits != null ? Number(attrs.payments_credits) : null,
    penalty: attrs.penalty != null ? Number(attrs.penalty) : null,
    interest: attrs.interest != null ? Number(attrs.interest) : null,
    other: attrs.other != null ? Number(attrs.other) : null,
  };
}
