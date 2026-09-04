"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import type {
  ApprovalJSON,
  PreReleaseFormData,
  PublicationType,
} from "@catalog/models/approval";
import {
  AI_USE_LABELS,
  AI_USES,
  isAiUse,
  isPublicationType,
  PUBLICATION_TYPE_LABELS,
  PUBLICATION_TYPES,
  publicationTypeLabel,
  UH_AI_GUIDANCE_LABEL,
  UH_AI_GUIDANCE_URL,
} from "@catalog/models/approval";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDown, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { createApproval, updateApproval } from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Split a comma/semicolon/whitespace-separated address list into trimmed entries. */
function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isEmail(address: string): boolean {
  return z.string().email().safeParse(address).success;
}

const CERT_MESSAGE = "All five certifications must be confirmed to submit";

/**
 * Textareas open one row tall and grow with what's typed — most answers here
 * are a line or two, and a column of tall empty boxes buries the form. `min-h-9`
 * matches the Input height and overrides the component's own `min-h-16`.
 */
const TEXTAREA_CLASS = "field-sizing-content min-h-9 resize-y";

const formSchema = z
  .object({
    // A — Publication details
    name: z.string().min(1, "Title is required"),
    publicationType: z.enum(PUBLICATION_TYPES),
    publicationTypeOther: z.string(),
    secondaryPublicationTypes: z.array(z.enum(PUBLICATION_TYPES)),
    contributors: z
      .string()
      .min(1, "List all authors and substantial contributors"),
    targetReleaseDate: z.string().min(1, "Target release date is required"),
    documentUrl: z.string(),

    // B — Disclosures
    conflictsOfInterest: z
      .string()
      .min(1, 'Required — enter "none" if applicable'),
    fundingSources: z.string().min(1, 'Required — enter "none" if applicable'),
    dataRestrictions: z.string(),
    aiUsage: z.enum(["none", "followed_guidance"]),
    aiUses: z.array(z.enum(AI_USES)),
    aiUsageOther: z.string(),

    // C — Development and prior review
    reviewers: z.string(),
    stakeholderInput: z.string(),

    // D — Lead author certification
    certAccurate: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),
    certEvidence: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),
    certUncertainties: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),
    certCompliance: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),
    certIndependent: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),

    // E — Availability and dissemination
    availableOnRelease: z.enum(["yes", "no"]),
    mediaContactName: z.string(),
    mediaContactEmail: z.string(),
    mediaContactPhone: z.string(),

    recipients: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.publicationType === "other" && !v.publicationTypeOther.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["publicationTypeOther"],
        message: "Describe the publication type",
      });
    }

    // Disclosing that AI was used without saying how leaves the reviewer with
    // less than the "no AI" answer would have given them.
    if (v.aiUsage === "followed_guidance") {
      if (!v.aiUses.length) {
        ctx.addIssue({
          code: "custom",
          path: ["aiUses"],
          message: "Select at least one way AI was used",
        });
      }
      if (v.aiUses.includes("other") && !v.aiUsageOther.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["aiUsageOther"],
          message: "Describe the other use",
        });
      }
    }

    if (
      v.documentUrl.trim() &&
      !/^https?:\/\/\S+$/i.test(v.documentUrl.trim())
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["documentUrl"],
        message: "Must be a full URL starting with http:// or https://",
      });
    }

    // If someone is on call for media, we need a way to reach them — otherwise
    // "yes" is an answer nobody can act on.
    if (v.availableOnRelease === "yes") {
      if (!v.mediaContactName.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["mediaContactName"],
          message: "Required when available for media inquiries",
        });
      }
      if (!v.mediaContactEmail.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["mediaContactEmail"],
          message: "Required when available for media inquiries",
        });
      }
    }

    if (!v.recipients.length) {
      ctx.addIssue({
        code: "custom",
        path: ["recipients"],
        message: "Notify at least one recipient",
      });
    }

    const bad = v.recipients.filter((a) => !isEmail(a));
    if (bad.length) {
      ctx.addIssue({
        code: "custom",
        path: ["recipients"],
        message: `Not valid email addresses: ${bad.join(", ")}`,
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

const EMPTY: Omit<FormValues, "recipients"> = {
  name: "",
  publicationType: "working_paper",
  publicationTypeOther: "",
  secondaryPublicationTypes: [],
  contributors: "",
  targetReleaseDate: "",
  documentUrl: "",
  conflictsOfInterest: "",
  fundingSources: "",
  dataRestrictions: "",
  aiUsage: "none",
  aiUses: [],
  aiUsageOther: "",
  reviewers: "",
  stakeholderInput: "",
  certAccurate: false,
  certEvidence: false,
  certUncertainties: false,
  certCompliance: false,
  certIndependent: false,
  availableOnRelease: "yes",
  mediaContactName: "",
  mediaContactEmail: "",
  mediaContactPhone: "",
};

/**
 * A submission saved under a type we no longer offer can't be represented in
 * the picker, and leaving it selected would fail enum validation on save. Move
 * it into "Other" so its meaning survives the edit.
 */
function toFormPublicationType(d: PreReleaseFormData): {
  publicationType: FormValues["publicationType"];
  publicationTypeOther: string;
} {
  const stored = d.publicationType;
  if (!stored) {
    return { publicationType: "working_paper", publicationTypeOther: "" };
  }
  if (isPublicationType(stored)) {
    return {
      publicationType: stored,
      publicationTypeOther: d.publicationTypeOther ?? "",
    };
  }
  return {
    publicationType: "other",
    publicationTypeOther:
      d.publicationTypeOther || publicationTypeLabel(stored),
  };
}

function toFormValues(
  approval: ApprovalJSON,
  standardRecipients: string[],
): FormValues {
  const d = approval.formData;
  return {
    name: approval.name,
    ...toFormPublicationType(d),
    // Drop anything retired or unrecognized rather than feeding the enum a
    // value the picker can't show.
    secondaryPublicationTypes: (d.secondaryPublicationTypes ?? []).filter(
      isPublicationType,
    ),
    contributors: d.contributors ?? "",
    targetReleaseDate: approval.targetReleaseDate ?? "",
    documentUrl: d.documentUrl ?? "",
    conflictsOfInterest: d.conflictsOfInterest ?? "",
    fundingSources: d.fundingSources ?? "",
    dataRestrictions: d.dataRestrictions ?? "",
    aiUsage: d.aiUsage ?? "none",
    aiUses: (d.aiUses ?? []).filter(isAiUse),
    aiUsageOther: d.aiUsageOther ?? "",
    reviewers: d.reviewers ?? "",
    stakeholderInput: d.stakeholderInput ?? "",
    certAccurate: d.certAccurate ?? false,
    certEvidence: d.certEvidence ?? false,
    certUncertainties: d.certUncertainties ?? false,
    certCompliance: d.certCompliance ?? false,
    certIndependent: d.certIndependent ?? false,
    availableOnRelease: d.availableOnRelease ?? "yes",
    mediaContactName: d.mediaContactName ?? "",
    mediaContactEmail: d.mediaContactEmail ?? "",
    mediaContactPhone: d.mediaContactPhone ?? "",
    // Submissions predating the editable list stored only the extras, with the
    // standard list implied — same fallback the mailer uses.
    recipients: d.recipients ?? [
      ...new Set([...standardRecipients, ...(d.additionalRecipients ?? [])]),
    ],
  };
}

const CERTIFICATIONS = [
  {
    key: "certAccurate",
    label:
      "The work is accurate, has integrity, and is appropriately presented, including any AI-assisted content.",
  },
  {
    key: "certEvidence",
    label: "The evidence and methods support the conclusions.",
  },
  {
    key: "certUncertainties",
    label: "Uncertainties, assumptions, and limitations are clearly stated.",
  },
  {
    key: "certCompliance",
    label:
      "The work complies with applicable UH policies, research protocols, disclosure requirements, and professional standards.",
  },
  {
    key: "certIndependent",
    label: "The manuscript is the independent work of the authors.",
  },
] as const;

/** A titled block of fields. Sections are divided by <Separator />, not cards. */
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="space-y-0.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Multi-select for the formats derived from the primary one.
 *
 * "Other" is excluded — it only means anything alongside the free-text box
 * next to the primary picker, and one box can't describe two things.
 */
function SecondaryTypeSelect({
  value,
  onChange,
  primary,
}: {
  value: PublicationType[];
  onChange: (next: PublicationType[]) => void;
  primary: PublicationType;
}) {
  const options = PUBLICATION_TYPES.filter(
    (t) => t !== "other" && t !== primary,
  );

  const summary =
    value.length === 0
      ? "None"
      : value.length === 1
        ? PUBLICATION_TYPE_LABELS[value[0]]
        : `${value.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id="secondaryPublicationTypes"
          className="w-full cursor-pointer justify-between font-normal"
        >
          <span className={cn(!value.length && "text-muted-foreground")}>
            {summary}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1"
      >
        {options.map((type) => {
          const checked = value.includes(type);
          return (
            <button
              key={type}
              type="button"
              className="hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
              onClick={() =>
                onChange(
                  checked
                    ? value.filter((t) => t !== type)
                    : [...value, type].sort(
                        (a, b) =>
                          PUBLICATION_TYPES.indexOf(a) -
                          PUBLICATION_TYPES.indexOf(b),
                      ),
                )
              }
            >
              {/* The row owns the click; the box is display only. */}
              <Checkbox
                checked={checked}
                className="pointer-events-none"
                tabIndex={-1}
              />
              {PUBLICATION_TYPE_LABELS[type]}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Editable notification list.
 *
 * Seeded with the standard recipients, but every entry is removable — the list
 * that survives here is exactly who gets mailed on submission.
 */
function RecipientEditor({
  value,
  onChange,
  standardRecipients,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  standardRecipients: string[];
}) {
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  const missingStandard = standardRecipients.filter(
    (a) => !value.some((v) => v.toLowerCase() === a.toLowerCase()),
  );

  function addDraft() {
    const entries = parseRecipients(draft);
    if (!entries.length) {
      setDraftError(null);
      return;
    }

    const bad = entries.filter((a) => !isEmail(a));
    if (bad.length) {
      setDraftError(`Not valid email addresses: ${bad.join(", ")}`);
      return;
    }

    // Adding someone already on the list is a no-op, not an error.
    const existing = new Set(value.map((a) => a.toLowerCase()));
    const fresh = entries.filter((a) => !existing.has(a.toLowerCase()));

    onChange([...value, ...fresh]);
    setDraft("");
    setDraftError(null);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Add controls stack in their own column so the list beside them can
          grow without pushing the input down the page. */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={draft}
            placeholder="someone@hawaii.edu"
            aria-label="Add a recipient"
            onChange={(e) => {
              setDraft(e.target.value);
              if (draftError) setDraftError(null);
            }}
            // Enter would otherwise submit the whole form.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraft();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 cursor-pointer"
            onClick={addDraft}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        {draftError ? (
          <p className="text-destructive text-sm">{draftError}</p>
        ) : null}

        {missingStandard.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-auto cursor-pointer px-0 py-0"
            onClick={() => onChange([...value, ...missingStandard])}
          >
            <RotateCcw className="size-3" />
            Restore {missingStandard.length} standard recipient
            {missingStandard.length === 1 ? "" : "s"}
          </Button>
        ) : null}
      </div>

      {value.length ? (
        <ul className="divide-y self-start rounded-md border">
          {value.map((address) => (
            <li
              key={address}
              className="flex items-center justify-between gap-2 py-1 pr-1 pl-3 text-sm"
            >
              <span className="truncate">{address}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-7 cursor-pointer"
                aria-label={`Remove ${address}`}
                onClick={() => onChange(value.filter((a) => a !== address))}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground self-start rounded-md border border-dashed p-3 text-sm">
          No recipients — nobody will be notified.
        </p>
      )}
    </div>
  );
}

export function PreReleaseForm({
  mode,
  approval,
  authorName,
  standardRecipients,
}: {
  mode: "create" | "edit";
  approval?: ApprovalJSON | null;
  /** Signed-in user — always the lead author, shown read-only in section D. */
  authorName: string;
  /**
   * The default notification list, passed down from the server page so the
   * mailer module stays server-only rather than being pulled into the
   * client bundle. Seeds the editable list; not a floor.
   */
  standardRecipients: string[];
}) {
  const router = useRouter();
  const listHref = "/comms";
  // After saving an edit, land back on the record you were editing rather than
  // the list — you almost always want to confirm what you just changed.
  const returnHref =
    mode === "edit" && approval
      ? `${listHref}/pub-form/${approval.id}`
      : listHref;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: approval
      ? toFormValues(approval, standardRecipients)
      : { ...EMPTY, recipients: standardRecipients },
  });

  const errors = form.formState.errors;
  const publicationType = form.watch("publicationType");
  const secondaryTypes = form.watch("secondaryPublicationTypes");
  const aiUsage = form.watch("aiUsage");
  const aiUses = form.watch("aiUses");
  const availableOnRelease = form.watch("availableOnRelease");
  const recipients = form.watch("recipients");

  /** Picking a primary type has to evict it from the derived list. */
  function setPrimaryType(next: PublicationType) {
    form.setValue("publicationType", next);
    form.setValue(
      "secondaryPublicationTypes",
      secondaryTypes.filter((t) => t !== next),
    );
  }

  function toggleAiUse(use: FormValues["aiUses"][number], checked: boolean) {
    form.setValue(
      "aiUses",
      checked ? [...aiUses, use] : aiUses.filter((u) => u !== use),
      { shouldValidate: form.formState.isSubmitted },
    );
  }

  async function onSubmit(values: FormValues) {
    const formData: PreReleaseFormData = {
      publicationType: values.publicationType,
      publicationTypeOther: values.publicationTypeOther.trim() || null,
      secondaryPublicationTypes: values.secondaryPublicationTypes.filter(
        (t) => t !== values.publicationType,
      ),
      documentUrl: values.documentUrl.trim() || null,
      contributors: values.contributors,
      conflictsOfInterest: values.conflictsOfInterest,
      fundingSources: values.fundingSources,
      dataRestrictions: values.dataRestrictions,
      aiUsage: values.aiUsage,
      // Don't keep answers to a question the final form no longer asks.
      aiUses: values.aiUsage === "followed_guidance" ? values.aiUses : [],
      aiUsageOther:
        values.aiUsage === "followed_guidance" &&
        values.aiUses.includes("other")
          ? values.aiUsageOther.trim() || null
          : null,
      reviewers: values.reviewers,
      stakeholderInput: values.stakeholderInput,
      certAccurate: values.certAccurate,
      certEvidence: values.certEvidence,
      certUncertainties: values.certUncertainties,
      certCompliance: values.certCompliance,
      certIndependent: values.certIndependent,
      availableOnRelease: values.availableOnRelease,
      mediaContactName: values.mediaContactName,
      mediaContactEmail: values.mediaContactEmail,
      mediaContactPhone: values.mediaContactPhone,
      recipients: values.recipients,
      // Set server-side at submit time; ignored on the way in.
      notifiedRecipients: [],
    };

    const payload = {
      name: values.name,
      targetReleaseDate: values.targetReleaseDate || null,
      formData,
    };

    try {
      const result =
        mode === "create"
          ? await createApproval(payload)
          : await updateApproval(approval!.id, payload);
      toast.success(result.message);
      router.push(returnHref);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save the form",
      );
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormSection title="A. Publication details">
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Title</FieldLabel>
            <Input id="name" {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>

          <div
            className={cn(
              "grid gap-3 sm:grid-cols-2",
              publicationType === "other" && "sm:grid-cols-3",
            )}
          >
            <Field data-invalid={!!errors.publicationType}>
              <FieldLabel htmlFor="publicationType">Primary type</FieldLabel>
              <Select
                value={publicationType}
                onValueChange={(v) => setPrimaryType(v as PublicationType)}
              >
                <SelectTrigger id="publicationType" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PUBLICATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PUBLICATION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[errors.publicationType]} />
            </Field>

            <Field data-invalid={!!errors.secondaryPublicationTypes}>
              <FieldLabel htmlFor="secondaryPublicationTypes">
                Secondary types
              </FieldLabel>
              <SecondaryTypeSelect
                value={secondaryTypes}
                primary={publicationType}
                onChange={(next) =>
                  form.setValue("secondaryPublicationTypes", next)
                }
              />
              <FieldDescription>
                Other formats cut from the same work, if any.
              </FieldDescription>
              <FieldError errors={[errors.secondaryPublicationTypes]} />
            </Field>

            {publicationType === "other" && (
              <Field data-invalid={!!errors.publicationTypeOther}>
                <FieldLabel htmlFor="publicationTypeOther">
                  Describe the publication type
                </FieldLabel>
                <Input
                  id="publicationTypeOther"
                  {...form.register("publicationTypeOther")}
                />
                <FieldError errors={[errors.publicationTypeOther]} />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="leadAuthor">Lead author</FieldLabel>
              <Input id="leadAuthor" value={authorName} disabled readOnly />
              <FieldDescription>
                Taken from your account. The lead author submits this form.
              </FieldDescription>
            </Field>

            <Field data-invalid={!!errors.targetReleaseDate}>
              <FieldLabel htmlFor="targetReleaseDate">
                Target release date
              </FieldLabel>
              <Input
                id="targetReleaseDate"
                type="date"
                {...form.register("targetReleaseDate")}
              />
              <FieldError errors={[errors.targetReleaseDate]} />
            </Field>

            <Field data-invalid={!!errors.documentUrl}>
              <FieldLabel htmlFor="documentUrl">Link to draft</FieldLabel>
              <Input
                id="documentUrl"
                placeholder="https://…"
                {...form.register("documentUrl")}
              />
              <FieldDescription>
                Google Doc, PDF, or repository link reviewers can open.
              </FieldDescription>
              <FieldError errors={[errors.documentUrl]} />
            </Field>
          </div>

          <Field data-invalid={!!errors.contributors}>
            <FieldLabel htmlFor="contributors">
              All authors and substantial contributors
            </FieldLabel>
            <Textarea
              id="contributors"
              rows={1}
              className={TEXTAREA_CLASS}
              placeholder="Names and roles; note any non-UHERO affiliations"
              {...form.register("contributors")}
            />
            <FieldError errors={[errors.contributors]} />
          </Field>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection title="B. Disclosures">
        <FieldGroup>
          <Field data-invalid={!!errors.conflictsOfInterest}>
            <FieldLabel htmlFor="conflictsOfInterest">
              Conflicts of interest
            </FieldLabel>
            <Textarea
              id="conflictsOfInterest"
              rows={1}
              className={TEXTAREA_CLASS}
              placeholder='Financial, personal, or professional interests that bear on the work. Enter "none" if applicable.'
              {...form.register("conflictsOfInterest")}
            />
            <FieldError errors={[errors.conflictsOfInterest]} />
          </Field>

          <Field data-invalid={!!errors.fundingSources}>
            <FieldLabel htmlFor="fundingSources">Funding source(s)</FieldLabel>
            <Textarea
              id="fundingSources"
              rows={1}
              className={TEXTAREA_CLASS}
              {...form.register("fundingSources")}
            />
            <FieldError errors={[errors.fundingSources]} />
          </Field>

          <Field data-invalid={!!errors.dataRestrictions}>
            <FieldLabel htmlFor="dataRestrictions">
              Data restrictions or confidentiality obligations
            </FieldLabel>
            <Textarea
              id="dataRestrictions"
              rows={1}
              className={TEXTAREA_CLASS}
              placeholder="Anything affecting interpretation or release"
              {...form.register("dataRestrictions")}
            />
            <FieldError errors={[errors.dataRestrictions]} />
          </Field>

          <Field data-invalid={!!errors.aiUsage}>
            <FieldLabel>Use of AI</FieldLabel>
            <RadioGroup
              value={aiUsage}
              onValueChange={(v) =>
                form.setValue("aiUsage", v as FormValues["aiUsage"])
              }
              className="gap-1"
            >
              <Field orientation="horizontal">
                <RadioGroupItem value="none" id="ai-none" />
                <FieldLabel htmlFor="ai-none" className="font-normal">
                  No AI was used in preparing this work
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem value="followed_guidance" id="ai-guidance" />
                <FieldLabel htmlFor="ai-guidance" className="font-normal">
                  AI was used, and its use followed applicable{" "}
                  <a
                    href={UH_AI_GUIDANCE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {UH_AI_GUIDANCE_LABEL}
                  </a>
                </FieldLabel>
              </Field>
            </RadioGroup>
            <FieldError errors={[errors.aiUsage]} />
          </Field>

          {aiUsage === "followed_guidance" && (
            <Field
              data-invalid={!!errors.aiUses || !!errors.aiUsageOther}
              // Indented to read as a follow-up to the radio above it.
              className="border-muted ml-1.5 border-l pl-4"
            >
              <FieldLabel>How AI was used</FieldLabel>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {AI_USES.map((use) => (
                  <Field
                    key={use}
                    orientation="horizontal"
                    className="w-auto gap-2"
                  >
                    <Checkbox
                      id={`ai-use-${use}`}
                      checked={aiUses.includes(use)}
                      onCheckedChange={(checked) =>
                        toggleAiUse(use, checked === true)
                      }
                    />
                    <FieldLabel
                      htmlFor={`ai-use-${use}`}
                      className="font-normal"
                    >
                      {AI_USE_LABELS[use]}
                    </FieldLabel>
                  </Field>
                ))}
              </div>
              <FieldError errors={[errors.aiUses]} />

              {aiUses.includes("other") && (
                <Input
                  id="aiUsageOther"
                  aria-label="Describe the other use of AI"
                  placeholder="Describe the other use"
                  className="mt-1"
                  {...form.register("aiUsageOther")}
                />
              )}
              <FieldError errors={[errors.aiUsageOther]} />
            </Field>
          )}
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection title="C. Development and prior review">
        <FieldGroup>
          <Field data-invalid={!!errors.reviewers}>
            <FieldLabel htmlFor="reviewers">
              Who commented on, reviewed, or contributed during development
            </FieldLabel>
            <Textarea
              id="reviewers"
              rows={1}
              className={TEXTAREA_CLASS}
              {...form.register("reviewers")}
            />
            <FieldError errors={[errors.reviewers]} />
          </Field>

          <Field data-invalid={!!errors.stakeholderInput}>
            <FieldLabel htmlFor="stakeholderInput">
              Stakeholder input already sought, if any
            </FieldLabel>
            <Textarea
              id="stakeholderInput"
              rows={1}
              className={TEXTAREA_CLASS}
              {...form.register("stakeholderInput")}
            />
            <FieldError errors={[errors.stakeholderInput]} />
          </Field>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection
        title="D. Lead author certification"
        description="On behalf of all authors. Confirm each — all five are required."
      >
        {/* gap-1: these are one-line checkbox rows, not labelled inputs. */}
        <FieldGroup className="gap-1">
          {/*
            orientation="horizontal" is required here, not cosmetic: the
            default vertical variant applies `[&>*]:w-full` to every direct
            child, which overrides the Checkbox's own `size-4` and stretches
            it across the row.
          */}
          {CERTIFICATIONS.map((cert) => (
            <Field
              key={cert.key}
              orientation="horizontal"
              data-invalid={!!errors[cert.key]}
            >
              <Checkbox
                id={cert.key}
                checked={form.watch(cert.key)}
                onCheckedChange={(checked) =>
                  form.setValue(cert.key, checked === true, {
                    shouldValidate: form.formState.isSubmitted,
                  })
                }
              />
              <FieldContent>
                <FieldLabel htmlFor={cert.key} className="font-normal">
                  {cert.label}
                </FieldLabel>
                <FieldError errors={[errors[cert.key]]} />
              </FieldContent>
            </Field>
          ))}

          <FieldDescription className="mt-2">
            Certified by <strong>{authorName}</strong>
            {approval?.createdAt
              ? ` — submitted ${new Date(approval.createdAt).toLocaleDateString()}`
              : " on submission"}
            .
          </FieldDescription>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection title="E. Availability and dissemination">
        <FieldGroup>
          <Field>
            <FieldLabel>
              Lead author available on release day for media inquiries
            </FieldLabel>
            <RadioGroup
              value={availableOnRelease}
              onValueChange={(v) =>
                form.setValue(
                  "availableOnRelease",
                  v as FormValues["availableOnRelease"],
                )
              }
              className="flex gap-6"
            >
              <Field orientation="horizontal" className="w-auto">
                <RadioGroupItem value="yes" id="avail-yes" />
                <FieldLabel htmlFor="avail-yes" className="font-normal">
                  Yes
                </FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <RadioGroupItem value="no" id="avail-no" />
                <FieldLabel htmlFor="avail-no" className="font-normal">
                  No
                </FieldLabel>
              </Field>
            </RadioGroup>
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field data-invalid={!!errors.mediaContactName}>
              <FieldLabel htmlFor="mediaContactName">
                {availableOnRelease === "yes"
                  ? "Contact name"
                  : "Alternate contact"}
              </FieldLabel>
              <Input
                id="mediaContactName"
                {...form.register("mediaContactName")}
              />
              <FieldError errors={[errors.mediaContactName]} />
            </Field>

            <Field data-invalid={!!errors.mediaContactEmail}>
              <FieldLabel htmlFor="mediaContactEmail">Contact email</FieldLabel>
              <Input
                id="mediaContactEmail"
                type="email"
                {...form.register("mediaContactEmail")}
              />
              <FieldError errors={[errors.mediaContactEmail]} />
            </Field>

            <Field data-invalid={!!errors.mediaContactPhone}>
              <FieldLabel htmlFor="mediaContactPhone">Contact phone</FieldLabel>
              <Input
                id="mediaContactPhone"
                {...form.register("mediaContactPhone")}
              />
              <FieldError errors={[errors.mediaContactPhone]} />
            </Field>
          </div>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection
        title="Notification"
        description="Everyone on this list is emailed the submitted form. It starts with the standard UHERO recipients — add or remove anyone before submitting."
      >
        <FieldGroup>
          <Field data-invalid={!!errors.recipients}>
            <FieldLabel>Recipients</FieldLabel>
            <RecipientEditor
              value={recipients}
              standardRecipients={standardRecipients}
              onChange={(next) =>
                form.setValue("recipients", next, {
                  shouldValidate: form.formState.isSubmitted,
                })
              }
            />
            <FieldError errors={[errors.recipients]} />
          </Field>
        </FieldGroup>
      </FormSection>

      <Separator />

      <div className="flex justify-end gap-2 pb-8">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push(returnHref)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="cursor-pointer"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Submit form"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
