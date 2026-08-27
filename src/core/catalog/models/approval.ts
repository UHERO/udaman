import type { Universe } from "../types/shared";

/** Kinds of approval. Only the pre-release form exists today. */
export const APPROVAL_TYPES = ["pre_release"] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const PUBLICATION_TYPES = [
  "briefs",
  "insights",
  "forecast",
  "working_paper",
  "publication",
  "focus_video",
  "report",
  "other",
] as const;
export type PublicationType = (typeof PUBLICATION_TYPES)[number];

export const PUBLICATION_TYPE_LABELS: Record<PublicationType, string> = {
  briefs: "Briefs",
  insights: "Insights",
  forecast: "Forecast",
  working_paper: "Working paper",
  publication: "Publication",
  focus_video: "Focus video",
  report: "Report",
  other: "Other",
};

/**
 * Types no longer offered in the picker.
 *
 * Submissions keep whatever value they were saved with, so the read-only views
 * still need labels for these. Editing such a submission moves the old type
 * into the "Other" free-text box (see the form).
 */
export const RETIRED_PUBLICATION_TYPE_LABELS: Record<string, string> = {
  policy_brief: "Policy brief",
  blog_post: "Blog post",
  dataset: "Dataset",
  press_release: "Press release",
};

export function isPublicationType(value: string): value is PublicationType {
  return (PUBLICATION_TYPES as readonly string[]).includes(value);
}

/** Human label for a stored type, including retired and unrecognized values. */
export function publicationTypeLabel(type: string): string {
  return (
    PUBLICATION_TYPE_LABELS[type as PublicationType] ??
    RETIRED_PUBLICATION_TYPE_LABELS[type] ??
    type
  );
}

/** Label for display, with the submitter's own wording appended for "Other". */
export function formatPublicationType(data: {
  publicationType: string;
  publicationTypeOther?: string | null;
}): string {
  const label = publicationTypeLabel(data.publicationType);
  return data.publicationType === "other" && data.publicationTypeOther
    ? `${label} — ${data.publicationTypeOther}`
    : label;
}

/** Comma-joined labels for the derived formats, or null when there are none. */
export function formatSecondaryTypes(
  types: string[] | null | undefined,
): string | null {
  if (!types?.length) return null;
  return types.map(publicationTypeLabel).join(", ");
}

/** Ways AI may have contributed, asked only when AI was used at all. */
export const AI_USES = [
  "editing",
  "drafting",
  "background",
  "code_data",
  "other",
] as const;
export type AiUse = (typeof AI_USES)[number];

export const AI_USE_LABELS: Record<AiUse, string> = {
  editing: "Editing",
  drafting: "Drafting",
  background: "Background",
  code_data: "Code/data",
  other: "Other",
};

export function isAiUse(value: string): value is AiUse {
  return (AI_USES as readonly string[]).includes(value);
}

/** UH's guidance on AI use, linked wherever the disclosure is shown. */
export const UH_AI_GUIDANCE_URL = "http://go.hawaii.edu/btr";
export const UH_AI_GUIDANCE_LABEL = "University of Hawaiʻi guidance";

type AiUsageData = {
  aiUsage: "none" | "followed_guidance";
  aiUses?: string[] | null;
  aiUsageOther?: string | null;
};

/**
 * The AI disclosure split so renderers can hyperlink the guidance label.
 * `link` is null when there's nothing to link (no AI used).
 */
export function formatAiUsageParts(data: AiUsageData): {
  prefix: string;
  link: { label: string; href: string } | null;
  suffix: string;
} {
  if (data.aiUsage === "none") {
    return {
      prefix: "No AI used in preparing the work",
      link: null,
      suffix: "",
    };
  }

  const uses = (data.aiUses ?? []).map((use) =>
    use === "other" && data.aiUsageOther
      ? `Other — ${data.aiUsageOther}`
      : (AI_USE_LABELS[use as AiUse] ?? use),
  );
  return {
    prefix: "AI used; followed applicable ",
    link: { label: UH_AI_GUIDANCE_LABEL, href: UH_AI_GUIDANCE_URL },
    suffix: uses.length ? ` (${uses.join(", ")})` : "",
  };
}

/** One-line plain-text summary of the AI disclosure, including which uses were checked. */
export function formatAiUsage(data: AiUsageData): string {
  const { prefix, link, suffix } = formatAiUsageParts(data);
  return `${prefix}${link?.label ?? ""}${suffix}`;
}

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
  /** The format this work is primarily released as. */
  publicationType: PublicationType;
  publicationTypeOther: string | null;
  /**
   * Further formats derived from the primary one — a Focus video or an
   * Insights post cut from the same working paper, say. "other" is not
   * offered here; a derived format that needs describing belongs in its own
   * submission.
   */
  secondaryPublicationTypes: PublicationType[];
  documentUrl: string | null;
  contributors: string;

  // B — Disclosures
  conflictsOfInterest: string;
  fundingSources: string;
  dataRestrictions: string;
  /** "none" = no AI used; "followed_guidance" = AI used, per UH guidance. */
  aiUsage: "none" | "followed_guidance";
  /** Which kinds of assistance. Only meaningful when aiUsage is "followed_guidance". */
  aiUses: AiUse[];
  /** Free text, required when aiUses includes "other". */
  aiUsageOther: string | null;

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

  /**
   * Everyone the submitter chose to notify. Seeded from PRE_RELEASE_RECIPIENTS
   * on a new form, then freely added to or removed from before submitting.
   */
  recipients: string[];
  /**
   * Extra addresses on top of a then-fixed standard list.
   *
   * @deprecated Superseded by `recipients`, which carries the whole list. Kept
   * so submissions saved before the list became editable still read back.
   */
  additionalRecipients?: string[];
  /** Who we actually emailed, resolved at submit time. Audit trail. */
  notifiedRecipients: string[];
};

/** Reviews an approval needs before it counts as "reviewed". */
export const REQUIRED_REVIEWS = 3;

/**
 * Accounts allowed to review their own forms. Authors normally can't — the
 * count is meant to be independent eyes — but a developer needs to exercise
 * the review flow without a second account.
 */
export const SELF_REVIEW_EXEMPT_EMAILS = ["wood2@hawaii.edu"];

export function canSelfReview(email: string | null | undefined): boolean {
  return !!email && SELF_REVIEW_EXEMPT_EMAILS.includes(email.toLowerCase());
}

/**
 * Filters the list page offers. Both axes are derived at read time:
 * reviewed = reviewCount >= REQUIRED_REVIEWS, released = releasedAt set.
 */
export const APPROVAL_STATUS_FILTERS = [
  "all",
  "unreleased",
  "released",
  "not_reviewed",
  "reviewed",
] as const;
export type ApprovalStatusFilter = (typeof APPROVAL_STATUS_FILTERS)[number];

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatusFilter, string> = {
  all: "All items",
  unreleased: "Unreleased",
  released: "Released",
  not_reviewed: "Not reviewed",
  reviewed: "Reviewed",
};

/** Shared by the model and the JSON the list page receives. */
export function approvalMatchesStatus(
  a: { isReviewed: boolean; isReleased: boolean },
  filter: ApprovalStatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "released":
      return a.isReleased;
    case "unreleased":
      return !a.isReleased;
    case "reviewed":
      return a.isReviewed;
    case "not_reviewed":
      return !a.isReviewed;
  }
}

export function isApprovalStatusFilter(
  value: string | undefined,
): value is ApprovalStatusFilter {
  return (APPROVAL_STATUS_FILTERS as readonly string[]).includes(value ?? "");
}

export type ApprovalAttrs = {
  id: number;
  type?: string;
  universe?: string;
  name: string;
  author: string;
  author_user_id: number;
  target_release_date?: Date | string | null;
  form_data?: unknown;
  released_at?: Date | string | null;
  released_by_user_id?: number | null;
  deleted_at?: Date | string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
  /** Aggregates joined in by the collection; absent on bare rows. */
  review_count?: number | string | null;
  reviewed_by_me?: number | string | null;
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
  releasedAt: Date | null;
  releasedByUserId: number | null;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** Number of reviews on file. 0 when the row was loaded without the join. */
  reviewCount: number;
  /** Whether the viewing user has already reviewed this one. */
  reviewedByMe: boolean;

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
    this.releasedAt = toDate(attrs.released_at);
    this.releasedByUserId = attrs.released_by_user_id ?? null;
    this.deletedAt = toDate(attrs.deleted_at);
    this.createdAt = toDate(attrs.created_at);
    this.updatedAt = toDate(attrs.updated_at);
    // COUNT() comes back as a string on some driver paths.
    this.reviewCount = Number(attrs.review_count ?? 0);
    this.reviewedByMe = Number(attrs.reviewed_by_me ?? 0) > 0;
  }

  get isReviewed(): boolean {
    return this.reviewCount >= REQUIRED_REVIEWS;
  }

  get isReleased(): boolean {
    return this.releasedAt !== null;
  }

  matchesStatus(filter: ApprovalStatusFilter): boolean {
    return approvalMatchesStatus(this, filter);
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
      releasedAt: this.releasedAt?.toISOString() ?? null,
      releasedByUserId: this.releasedByUserId,
      reviewCount: this.reviewCount,
      requiredReviews: REQUIRED_REVIEWS,
      isReviewed: this.isReviewed,
      isReleased: this.isReleased,
      reviewedByMe: this.reviewedByMe,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export type ApprovalJSON = ReturnType<Approval["toJSON"]>;

export default Approval;
