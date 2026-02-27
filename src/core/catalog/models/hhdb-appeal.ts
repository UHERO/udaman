export interface HhdbAppealAttrs {
  id?: number | null;
  tmk?: string | null;
  year?: number | null;
  appeal_type_value?: string | null;
  scheduled_hearing_date_subject_to_change?: string | null;
  status?: string | null;
  date_settled?: Date | string | null;
  final_value?: number | null;
  tax_payer_opinion_of_value?: number | null;
  tax_payer_opinion_of_property_class?: string | null;
  tax_payer_opinion_of_exemptions?: number | null;
}

export class HhdbAppeal {
  id: number | null;
  tmk: string | null;
  year: number | null;
  appealTypeValue: string | null;
  scheduledHearingDateSubjectToChange: string | null;
  status: string | null;
  dateSettled: Date | null;
  finalValue: number | null;
  taxPayerOpinionOfValue: number | null;
  taxPayerOpinionOfPropertyClass: string | null;
  taxPayerOpinionOfExemptions: number | null;

  constructor(attrs: HhdbAppealAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.year = attrs.year != null ? Number(attrs.year) : null;
    this.appealTypeValue = attrs.appeal_type_value ?? null;
    this.scheduledHearingDateSubjectToChange = attrs.scheduled_hearing_date_subject_to_change ?? null;
    this.status = attrs.status ?? null;
    this.dateSettled = attrs.date_settled ? new Date(attrs.date_settled) : null;
    this.finalValue = attrs.final_value != null ? Number(attrs.final_value) : null;
    this.taxPayerOpinionOfValue = attrs.tax_payer_opinion_of_value != null ? Number(attrs.tax_payer_opinion_of_value) : null;
    this.taxPayerOpinionOfPropertyClass = attrs.tax_payer_opinion_of_property_class ?? null;
    this.taxPayerOpinionOfExemptions = attrs.tax_payer_opinion_of_exemptions != null ? Number(attrs.tax_payer_opinion_of_exemptions) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      year: this.year,
      appealTypeValue: this.appealTypeValue,
      scheduledHearingDateSubjectToChange: this.scheduledHearingDateSubjectToChange,
      status: this.status,
      dateSettled: this.dateSettled?.toISOString() ?? null,
      finalValue: this.finalValue,
      taxPayerOpinionOfValue: this.taxPayerOpinionOfValue,
      taxPayerOpinionOfPropertyClass: this.taxPayerOpinionOfPropertyClass,
      taxPayerOpinionOfExemptions: this.taxPayerOpinionOfExemptions,
    };
  }
}

export type HhdbAppealJSON = ReturnType<HhdbAppeal["toJSON"]>;

export function hhdbAppealRowToJSON(attrs: HhdbAppealAttrs): HhdbAppealJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    year: attrs.year != null ? Number(attrs.year) : null,
    appealTypeValue: attrs.appeal_type_value ?? null,
    scheduledHearingDateSubjectToChange: attrs.scheduled_hearing_date_subject_to_change ?? null,
    status: attrs.status ?? null,
    dateSettled: attrs.date_settled ? new Date(attrs.date_settled).toISOString() : null,
    finalValue: attrs.final_value != null ? Number(attrs.final_value) : null,
    taxPayerOpinionOfValue: attrs.tax_payer_opinion_of_value != null ? Number(attrs.tax_payer_opinion_of_value) : null,
    taxPayerOpinionOfPropertyClass: attrs.tax_payer_opinion_of_property_class ?? null,
    taxPayerOpinionOfExemptions: attrs.tax_payer_opinion_of_exemptions != null ? Number(attrs.tax_payer_opinion_of_exemptions) : null,
  };
}
