export type ReloadJobAttrs = {
  id: number;
  user_id?: number | null;
  created_at?: Date | string | null;
  status?: "processing" | "done" | "fail" | null;
  finished_at?: Date | string | null;
  params?: string | null;
  update_public?: boolean | number | null;
  error?: string | null;
};

export type SerializedReloadJob = ReturnType<ReloadJob["toJSON"]>;

class ReloadJob {
  readonly id: number;
  userId: number | null;
  createdAt: Date | null;
  status: "processing" | "done" | "fail" | null;
  finishedAt: Date | null;
  params: string | null;
  updatePublic: boolean;
  error: string | null;

  constructor(attrs: ReloadJobAttrs) {
    this.id = attrs.id;
    this.userId = attrs.user_id ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.status = attrs.status ?? null;
    this.finishedAt = attrs.finished_at
      ? new Date(attrs.finished_at as string | Date)
      : null;
    this.params = attrs.params ?? null;
    this.updatePublic = Boolean(attrs.update_public);
    this.error = attrs.error ?? null;
  }

  get displayStatus(): string {
    return this.status ?? "waiting";
  }

  toString(): string {
    return `ReloadJob#${this.id} [${this.displayStatus}]`;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      createdAt: this.createdAt,
      status: this.status,
      finishedAt: this.finishedAt,
      params: this.params,
      updatePublic: this.updatePublic,
      error: this.error,
    };
  }
}

export default ReloadJob;
