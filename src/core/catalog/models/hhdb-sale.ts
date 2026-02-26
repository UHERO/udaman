export interface HhdbSaleAttrs {
  id?: number;
  tmk?: string | null;
  sale_date?: Date | string | null;
  sale_amount?: number | null;
  instrument?: string | null;
  instrument_type?: string | null;
  instrument_description?: string | null;
  valid_sale?: string | null;
  date_of_recording?: Date | string | null;
  land_court_document_number?: string | null;
  book_page?: string | null;
  conveyance_tax?: number | null;
  document_type?: string | null;
}

export class HhdbSale {
  id: number;
  tmk: string | null;
  saleDate: Date | null;
  saleAmount: number | null;
  instrument: string | null;
  instrumentType: string | null;
  instrumentDescription: string | null;
  validSale: string | null;
  dateOfRecording: Date | null;
  bookPage: string | null;
  conveyanceTax: number | null;
  documentType: string | null;

  constructor(attrs: HhdbSaleAttrs) {
    this.id = attrs.id ?? 0;
    this.tmk = attrs.tmk ?? null;
    this.saleDate = attrs.sale_date ? new Date(attrs.sale_date) : null;
    this.saleAmount = attrs.sale_amount != null ? Number(attrs.sale_amount) : null;
    this.instrument = attrs.instrument ?? null;
    this.instrumentType = attrs.instrument_type ?? null;
    this.instrumentDescription = attrs.instrument_description ?? null;
    this.validSale = attrs.valid_sale ?? null;
    this.dateOfRecording = attrs.date_of_recording ? new Date(attrs.date_of_recording) : null;
    this.bookPage = attrs.book_page ?? null;
    this.conveyanceTax = attrs.conveyance_tax != null ? Number(attrs.conveyance_tax) : null;
    this.documentType = attrs.document_type ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      saleDate: this.saleDate?.toISOString() ?? null,
      saleAmount: this.saleAmount,
      instrument: this.instrument,
      instrumentType: this.instrumentType,
      instrumentDescription: this.instrumentDescription,
      validSale: this.validSale,
      dateOfRecording: this.dateOfRecording?.toISOString() ?? null,
      bookPage: this.bookPage,
      conveyanceTax: this.conveyanceTax,
      documentType: this.documentType,
    };
  }
}

export type HhdbSaleJSON = ReturnType<HhdbSale["toJSON"]>;
