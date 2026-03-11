export interface HhdbHistoricalTaxSummaryAttrs {
  id?: number | null;
  tmk?: string | null;
  year?: number | null;
  tax?: number | null;
  payments_and_credits?: number | null;
  penalty?: number | null;
  interest?: number | null;
  other?: number | null;
  amount_due?: number | null;
  tax_details_total_tax?: number | null;
  tax_details_total_payments_credits?: number | null;
  tax_details_total_penalty?: number | null;
  tax_details_total_interest?: number | null;
  tax_details_total_other?: number | null;
  tax_payments_total_tax?: number | null;
  tax_payments_total_penalty?: number | null;
  tax_payments_total_interest?: number | null;
  tax_payments_total_other?: number | null;
  tax_credits_total_amount?: number | null;
}

export class HhdbHistoricalTaxSummary {
  id: number | null;
  tmk: string | null;
  year: number | null;
  tax: number | null;
  paymentsAndCredits: number | null;
  penalty: number | null;
  interest: number | null;
  other: number | null;
  amountDue: number | null;
  taxDetailsTotalTax: number | null;
  taxDetailsTotalPaymentsCredits: number | null;
  taxDetailsTotalPenalty: number | null;
  taxDetailsTotalInterest: number | null;
  taxDetailsTotalOther: number | null;
  taxPaymentsTotalTax: number | null;
  taxPaymentsTotalPenalty: number | null;
  taxPaymentsTotalInterest: number | null;
  taxPaymentsTotalOther: number | null;
  taxCreditsTotalAmount: number | null;

  constructor(attrs: HhdbHistoricalTaxSummaryAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.year = attrs.year != null ? Number(attrs.year) : null;
    this.tax = attrs.tax != null ? Number(attrs.tax) : null;
    this.paymentsAndCredits =
      attrs.payments_and_credits != null
        ? Number(attrs.payments_and_credits)
        : null;
    this.penalty = attrs.penalty != null ? Number(attrs.penalty) : null;
    this.interest = attrs.interest != null ? Number(attrs.interest) : null;
    this.other = attrs.other != null ? Number(attrs.other) : null;
    this.amountDue = attrs.amount_due != null ? Number(attrs.amount_due) : null;
    this.taxDetailsTotalTax =
      attrs.tax_details_total_tax != null
        ? Number(attrs.tax_details_total_tax)
        : null;
    this.taxDetailsTotalPaymentsCredits =
      attrs.tax_details_total_payments_credits != null
        ? Number(attrs.tax_details_total_payments_credits)
        : null;
    this.taxDetailsTotalPenalty =
      attrs.tax_details_total_penalty != null
        ? Number(attrs.tax_details_total_penalty)
        : null;
    this.taxDetailsTotalInterest =
      attrs.tax_details_total_interest != null
        ? Number(attrs.tax_details_total_interest)
        : null;
    this.taxDetailsTotalOther =
      attrs.tax_details_total_other != null
        ? Number(attrs.tax_details_total_other)
        : null;
    this.taxPaymentsTotalTax =
      attrs.tax_payments_total_tax != null
        ? Number(attrs.tax_payments_total_tax)
        : null;
    this.taxPaymentsTotalPenalty =
      attrs.tax_payments_total_penalty != null
        ? Number(attrs.tax_payments_total_penalty)
        : null;
    this.taxPaymentsTotalInterest =
      attrs.tax_payments_total_interest != null
        ? Number(attrs.tax_payments_total_interest)
        : null;
    this.taxPaymentsTotalOther =
      attrs.tax_payments_total_other != null
        ? Number(attrs.tax_payments_total_other)
        : null;
    this.taxCreditsTotalAmount =
      attrs.tax_credits_total_amount != null
        ? Number(attrs.tax_credits_total_amount)
        : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      year: this.year,
      tax: this.tax,
      paymentsAndCredits: this.paymentsAndCredits,
      penalty: this.penalty,
      interest: this.interest,
      other: this.other,
      amountDue: this.amountDue,
      taxDetailsTotalTax: this.taxDetailsTotalTax,
      taxDetailsTotalPaymentsCredits: this.taxDetailsTotalPaymentsCredits,
      taxDetailsTotalPenalty: this.taxDetailsTotalPenalty,
      taxDetailsTotalInterest: this.taxDetailsTotalInterest,
      taxDetailsTotalOther: this.taxDetailsTotalOther,
      taxPaymentsTotalTax: this.taxPaymentsTotalTax,
      taxPaymentsTotalPenalty: this.taxPaymentsTotalPenalty,
      taxPaymentsTotalInterest: this.taxPaymentsTotalInterest,
      taxPaymentsTotalOther: this.taxPaymentsTotalOther,
      taxCreditsTotalAmount: this.taxCreditsTotalAmount,
    };
  }
}

export type HhdbHistoricalTaxSummaryJSON = ReturnType<
  HhdbHistoricalTaxSummary["toJSON"]
>;

export function hhdbHistoricalTaxSummaryRowToJSON(
  attrs: HhdbHistoricalTaxSummaryAttrs,
): HhdbHistoricalTaxSummaryJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    year: attrs.year != null ? Number(attrs.year) : null,
    tax: attrs.tax != null ? Number(attrs.tax) : null,
    paymentsAndCredits:
      attrs.payments_and_credits != null
        ? Number(attrs.payments_and_credits)
        : null,
    penalty: attrs.penalty != null ? Number(attrs.penalty) : null,
    interest: attrs.interest != null ? Number(attrs.interest) : null,
    other: attrs.other != null ? Number(attrs.other) : null,
    amountDue: attrs.amount_due != null ? Number(attrs.amount_due) : null,
    taxDetailsTotalTax:
      attrs.tax_details_total_tax != null
        ? Number(attrs.tax_details_total_tax)
        : null,
    taxDetailsTotalPaymentsCredits:
      attrs.tax_details_total_payments_credits != null
        ? Number(attrs.tax_details_total_payments_credits)
        : null,
    taxDetailsTotalPenalty:
      attrs.tax_details_total_penalty != null
        ? Number(attrs.tax_details_total_penalty)
        : null,
    taxDetailsTotalInterest:
      attrs.tax_details_total_interest != null
        ? Number(attrs.tax_details_total_interest)
        : null,
    taxDetailsTotalOther:
      attrs.tax_details_total_other != null
        ? Number(attrs.tax_details_total_other)
        : null,
    taxPaymentsTotalTax:
      attrs.tax_payments_total_tax != null
        ? Number(attrs.tax_payments_total_tax)
        : null,
    taxPaymentsTotalPenalty:
      attrs.tax_payments_total_penalty != null
        ? Number(attrs.tax_payments_total_penalty)
        : null,
    taxPaymentsTotalInterest:
      attrs.tax_payments_total_interest != null
        ? Number(attrs.tax_payments_total_interest)
        : null,
    taxPaymentsTotalOther:
      attrs.tax_payments_total_other != null
        ? Number(attrs.tax_payments_total_other)
        : null,
    taxCreditsTotalAmount:
      attrs.tax_credits_total_amount != null
        ? Number(attrs.tax_credits_total_amount)
        : null,
  };
}
