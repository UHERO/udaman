export type ExtractorInputAttrs = {
  extractor_id: number;
  downloader_id: number;
  role?: string | null;
  /** Joined from data_downloaders when listed through the collection */
  downloader_handle?: string | null;
};

export type SerializedExtractorInput = ReturnType<ExtractorInput["toJSON"]>;

/**
 * An extractor reads a downloader's raw artifacts. `role` lets a parser
 * tell its inputs apart (e.g. "current" vs "archive").
 */
class ExtractorInput {
  extractorId: number;
  downloaderId: number;
  role: string | null;
  downloaderHandle: string | null;

  constructor(attrs: ExtractorInputAttrs) {
    this.extractorId = attrs.extractor_id;
    this.downloaderId = attrs.downloader_id;
    this.role = attrs.role ?? null;
    this.downloaderHandle = attrs.downloader_handle ?? null;
  }

  toJSON() {
    return {
      extractorId: this.extractorId,
      downloaderId: this.downloaderId,
      role: this.role,
      downloaderHandle: this.downloaderHandle,
    };
  }
}

export default ExtractorInput;
