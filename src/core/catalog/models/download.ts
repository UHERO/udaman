import { join } from "node:path";

export type DownloadAttrs = {
  id: number;
  handle?: string | null;
  sort1?: number | null;
  sort2?: number | null;
  url?: string | null;
  filename_ext?: string | null;
  post_parameters?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
  last_download_at?: Date | string | null;
  last_change_at?: Date | string | null;
  date_sensitive?: boolean | number | null;
  freeze_file?: boolean | number | null;
  file_to_extract?: string | null;
  sheet_override?: string | null;
  notes?: string | null;
};

class Download {
  readonly id: number;
  handle: string | null;
  sort1: number | null;
  sort2: number | null;
  url: string | null;
  filenameExt: string | null;
  postParameters: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastDownloadAt: Date | null;
  lastChangeAt: Date | null;
  dateSensitive: boolean;
  freezeFile: boolean;
  fileToExtract: string | null;
  sheetOverride: string | null;
  notes: string | null;

  constructor(attrs: DownloadAttrs) {
    this.id = attrs.id;
    this.handle = attrs.handle ?? null;
    this.sort1 = attrs.sort1 ?? null;
    this.sort2 = attrs.sort2 ?? null;
    this.url = attrs.url ?? null;
    this.filenameExt = attrs.filename_ext ?? null;
    this.postParameters = attrs.post_parameters ?? null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at as string | Date) : null;
    this.updatedAt = attrs.updated_at ? new Date(attrs.updated_at as string | Date) : null;
    this.lastDownloadAt = attrs.last_download_at ? new Date(attrs.last_download_at as string | Date) : null;
    this.lastChangeAt = attrs.last_change_at ? new Date(attrs.last_change_at as string | Date) : null;
    this.dateSensitive = Boolean(attrs.date_sensitive);
    this.freezeFile = Boolean(attrs.freeze_file);
    this.fileToExtract = attrs.file_to_extract ?? null;
    this.sheetOverride = attrs.sheet_override ?? null;
    this.notes = attrs.notes ?? null;
  }

  /** Root directory for raw downloaded files */
  static get root(): string {
    const dataDir = process.env.DATA_DIR ?? "./data";
    return join(dataDir, "rawdata");
  }

  /** Sanitize handle for use as a filename (replace @ with _) */
  sanitizeHandle(): string {
    return this.handle ? this.handle.replace(/@/g, "_") : "NO_HANDLE_DEFINED";
  }

  /** Full save path for the downloaded file */
  savePath(noExt = false): string {
    if (noExt) {
      return join(Download.root, this.sanitizeHandle());
    }
    return join(Download.root, `${this.sanitizeHandle()}.${this.filenameExt ?? "ext"}`);
  }

  /** Path after extraction (for zip files with file_to_extract set) */
  extractPath(): string | null {
    if (!this.fileToExtract) return null;
    return join(Download.root, this.sanitizeHandle(), this.fileToExtract);
  }

  /** Effective file path: extracted file if set, otherwise the save path */
  effectivePath(): string {
    return this.extractPath() ?? this.savePath();
  }

  toString(): string {
    return `Download#${this.id} <${this.handle}>`;
  }

  toJSON() {
    return {
      id: this.id,
      handle: this.handle,
      sort1: this.sort1,
      sort2: this.sort2,
      url: this.url,
      filenameExt: this.filenameExt,
      dateSensitive: this.dateSensitive,
      freezeFile: this.freezeFile,
      fileToExtract: this.fileToExtract,
      sheetOverride: this.sheetOverride,
      notes: this.notes,
    };
  }
}

export default Download;
