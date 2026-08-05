import type { Universe } from "../types/shared";

/** Kinds of approval. Only the pre-release form exists today. */
export const APPROVAL_TYPES = ["pre_release"] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const PUBLICATION_TYPES = [
  "working_paper",
  "policy_brief",
  "blog_post",
  "dataset",
  "forecast",
  "press_release",
  "other",
] as const;
export type PublicationType = (typeof PUBLICATION_TYPES)[number];

export const PUBLICATION_TYPE_LABELS: Record<PublicationType, string> = {
  working_paper: "Working paper",
  policy_brief: "Policy brief",
  blog_post: "Blog post",
  dataset: "Dataset",
  forecast: "Forecast",
  press_release: "Press release",
  other: "Other",
};

/**
 * Body of the UHERO Pre-Release Form, stored in `approvals.form_data`.
 *
 * Title, lead author and target release date are NOT here — they live in
 * structured columns because we list and sort by them. Everything below is
 * free-form disclosure text that only ever gets read back whole, so keeping
 * it in JSON lets the form change without a migration.
 */
export type PreReleaseFormData = {
  // A — Publication details
  publicationType: PublicationType;
  publicationTypeOther: string | null;
  documentUrl: string | null;
  contributors: string;

  // B — Disclosures
  conflictsOfInterest: string;
  fundingSources: string;
  dataRestrictions: string;
  /** "none" = no AI used; "followed_guidance" = AI used, per UH guidance. */
  aiUsage: "none" | "followed_guidance";

  // C — Development and prior review
  reviewers: string;
  stakeholderInput: string;

  // D — Lead author certification. All four must be true to submit.
  certAccurate: boolean;
  certEvidence: boolean;
  certUncertainties: boolean;
  certCompliance: boolean;

  // E — Availability and dissemination
  availableOnRelease: "yes" | "no";
  mediaContactName: string;
  mediaContactEmail: string;
  mediaContactPhone: string;

  /** Extra addresses the submitter asked us to notify, beyond the standard list. */
  additionalRecipients: string[];
  /** Who we actually emailed, resolved at submit time. Audit trail. */
  notifiedRecipients: string[];
};

export type ApprovalAttrs = {
  id: number;
  type?: string;
  universe?: string;
  name: string;
  author: string;
  author_user_id: number;
  target_release_date?: Date | string | null;
  form_data?: unknown;
  deleted_at?: Date | string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

/** MySQL DATE/DATETIME columns come back as Date or string depending on driver path. */
function toDate(value: Date | string | null | undefined): Date | null {
  return value ? new Date(value as string | Date) : null;
}

/** Render a DATE column as `YYYY-MM-DD` without tripping over local timezone. */
function toDateString(value: Date | null): string | null {
  if (!value) return null;
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

class Approval {
  readonly id: number;
  readonly type: ApprovalType;
  readonly universe: Universe;
  name: string;
  author: string;
  authorUserId: number;
  targetReleaseDate: Date | null;
  formData: PreReleaseFormData;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: ApprovalAttrs) {
    this.id = attrs.id;
    this.type = (attrs.type as ApprovalType) ?? "pre_release";
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.name = attrs.name;
    this.author = attrs.author;
    this.authorUserId = attrs.author_user_id;
    this.targetReleaseDate = toDate(attrs.target_release_date);
    // The driver hands back JSON columns already parsed on some paths and as a
    // raw string on others, so normalize both.
    this.formData =
      typeof attrs.form_data === "string"
        ? (JSON.parse(attrs.form_data) as PreReleaseFormData)
        : ((attrs.form_data ?? {}) as PreReleaseFormData);
    this.deletedAt = toDate(attrs.deleted_at);
    this.createdAt = toDate(attrs.created_at);
    this.updatedAt = toDate(attrs.updated_at);
  }

  toString(): string {
    return `${this.name} (${this.author})`;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      universe: this.universe,
      name: this.name,
      author: this.author,
      authorUserId: this.authorUserId,
      targetReleaseDate: toDateString(this.targetReleaseDate),
      formData: this.formData,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export type ApprovalJSON = ReturnType<Approval["toJSON"]>;

export default Approval;
