export type UploadStatus = "processing" | "ok" | "fail";

export type UniverseUploadAttrs = {
  id: number;
  upload_at?: Date | string | null;
  active?: boolean | number | null;
  status?: UploadStatus | null;
  filename?: string | null;
  last_error_at?: Date | string | null;
  last_error?: string | null;
};

class UniverseUpload {
  readonly id: number;
  uploadAt: Date | null;
  active: boolean;
  status: UploadStatus | null;
  filename: string | null;
  lastErrorAt: Date | null;
  lastError: string | null;

  constructor(attrs: UniverseUploadAttrs) {
    this.id = attrs.id;
    this.uploadAt = attrs.upload_at
      ? new Date(attrs.upload_at as string | Date)
      : null;
    this.active = Boolean(attrs.active);
    this.status = attrs.status ?? null;
    this.filename = attrs.filename ?? null;
    this.lastErrorAt = attrs.last_error_at
      ? new Date(attrs.last_error_at as string | Date)
      : null;
    this.lastError = attrs.last_error ?? null;
  }

  toString(): string {
    return `Upload(${this.id}, ${this.filename ?? "no file"})`;
  }

  toJSON() {
    return {
      id: this.id,
      uploadAt: this.uploadAt?.toISOString() ?? null,
      active: this.active,
      status: this.status,
      filename: this.filename,
      lastErrorAt: this.lastErrorAt?.toISOString() ?? null,
      lastError: this.lastError,
    };
  }
}

export default UniverseUpload;
