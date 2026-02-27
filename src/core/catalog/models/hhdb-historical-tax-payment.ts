export interface HhdbHistoricalTaxPaymentAttrs {
  id?: number | null;
  historical_tax_summary_id?: number | null;
  tmk?: string | null;
  payment_sequence?: string | null;
  effective_date?: Date | string | null;
  tax?: number | null;
  penalty?: number | null;
  interest?: number | null;
  other?: number | null;
}

export class HhdbHistoricalTaxPayment {
  id: number | null;
  historicalTaxSummaryId: number | null;
  tmk: string | null;
  paymentSequence: string | null;
  effectiveDate: Date | null;
  tax: number | null;
  penalty: number | null;
  interest: number | null;
  other: number | null;

  constructor(attrs: HhdbHistoricalTaxPaymentAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.historicalTaxSummaryId = attrs.historical_tax_summary_id != null ? Number(attrs.historical_tax_summary_id) : null;
    this.tmk = attrs.tmk ?? null;
    this.paymentSequence = attrs.payment_sequence ?? null;
    this.effectiveDate = attrs.effective_date ? new Date(attrs.effective_date) : null;
    this.tax = attrs.tax != null ? Number(attrs.tax) : null;
    this.penalty = attrs.penalty != null ? Number(attrs.penalty) : null;
    this.interest = attrs.interest != null ? Number(attrs.interest) : null;
    this.other = attrs.other != null ? Number(attrs.other) : null;
  }

  toJSON() {
    return {
      id: this.id,
      historicalTaxSummaryId: this.historicalTaxSummaryId,
      tmk: this.tmk,
      paymentSequence: this.paymentSequence,
      effectiveDate: this.effectiveDate?.toISOString() ?? null,
      tax: this.tax,
      penalty: this.penalty,
      interest: this.interest,
      other: this.other,
    };
  }
}

export type HhdbHistoricalTaxPaymentJSON = ReturnType<HhdbHistoricalTaxPayment["toJSON"]>;

export function hhdbHistoricalTaxPaymentRowToJSON(attrs: HhdbHistoricalTaxPaymentAttrs): HhdbHistoricalTaxPaymentJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    historicalTaxSummaryId: attrs.historical_tax_summary_id != null ? Number(attrs.historical_tax_summary_id) : null,
    tmk: attrs.tmk ?? null,
    paymentSequence: attrs.payment_sequence ?? null,
    effectiveDate: attrs.effective_date ? new Date(attrs.effective_date).toISOString() : null,
    tax: attrs.tax != null ? Number(attrs.tax) : null,
    penalty: attrs.penalty != null ? Number(attrs.penalty) : null,
    interest: attrs.interest != null ? Number(attrs.interest) : null,
    other: attrs.other != null ? Number(attrs.other) : null,
  };
}
