export interface HhdbCurrentTaxBillAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  tax_period?: string | null;
  description?: string | null;
  original_due_date?: Date | string | null;
  taxes_assessment?: number | null;
  tax_credits?: number | null;
  net_tax?: number | null;
  penalty?: number | null;
  interest?: number | null;
  other?: number | null;
  amount_due?: number | null;
}

export class HhdbCurrentTaxBill {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  taxPeriod: string | null;
  description: string | null;
  originalDueDate: Date | null;
  taxesAssessment: number | null;
  taxCredits: number | null;
  netTax: number | null;
  penalty: number | null;
  interest: number | null;
  other: number | null;
  amountDue: number | null;

  constructor(attrs: HhdbCurrentTaxBillAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.taxPeriod = attrs.tax_period ?? null;
    this.description = attrs.description ?? null;
    this.originalDueDate = attrs.original_due_date ? new Date(attrs.original_due_date) : null;
    this.taxesAssessment = attrs.taxes_assessment != null ? Number(attrs.taxes_assessment) : null;
    this.taxCredits = attrs.tax_credits != null ? Number(attrs.tax_credits) : null;
    this.netTax = attrs.net_tax != null ? Number(attrs.net_tax) : null;
    this.penalty = attrs.penalty != null ? Number(attrs.penalty) : null;
    this.interest = attrs.interest != null ? Number(attrs.interest) : null;
    this.other = attrs.other != null ? Number(attrs.other) : null;
    this.amountDue = attrs.amount_due != null ? Number(attrs.amount_due) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      taxPeriod: this.taxPeriod,
      description: this.description,
      originalDueDate: this.originalDueDate?.toISOString() ?? null,
      taxesAssessment: this.taxesAssessment,
      taxCredits: this.taxCredits,
      netTax: this.netTax,
      penalty: this.penalty,
      interest: this.interest,
      other: this.other,
      amountDue: this.amountDue,
    };
  }
}

export type HhdbCurrentTaxBillJSON = ReturnType<HhdbCurrentTaxBill["toJSON"]>;
