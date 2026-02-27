export interface HhdbHistoricalTaxCreditAttrs {
  id?: number | null;
  historical_tax_summary_id?: number | null;
  tmk?: string | null;
  period?: string | null;
  description?: string | null;
  amount?: number | null;
}

export class HhdbHistoricalTaxCredit {
  id: number | null;
  historicalTaxSummaryId: number | null;
  tmk: string | null;
  period: string | null;
  description: string | null;
  amount: number | null;

  constructor(attrs: HhdbHistoricalTaxCreditAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.historicalTaxSummaryId = attrs.historical_tax_summary_id != null ? Number(attrs.historical_tax_summary_id) : null;
    this.tmk = attrs.tmk ?? null;
    this.period = attrs.period ?? null;
    this.description = attrs.description ?? null;
    this.amount = attrs.amount != null ? Number(attrs.amount) : null;
  }

  toJSON() {
    return {
      id: this.id,
      historicalTaxSummaryId: this.historicalTaxSummaryId,
      tmk: this.tmk,
      period: this.period,
      description: this.description,
      amount: this.amount,
    };
  }
}

export type HhdbHistoricalTaxCreditJSON = ReturnType<HhdbHistoricalTaxCredit["toJSON"]>;

export function hhdbHistoricalTaxCreditRowToJSON(attrs: HhdbHistoricalTaxCreditAttrs): HhdbHistoricalTaxCreditJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    historicalTaxSummaryId: attrs.historical_tax_summary_id != null ? Number(attrs.historical_tax_summary_id) : null,
    tmk: attrs.tmk ?? null,
    period: attrs.period ?? null,
    description: attrs.description ?? null,
    amount: attrs.amount != null ? Number(attrs.amount) : null,
  };
}
