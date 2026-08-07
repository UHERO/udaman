"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import type {
  ApprovalJSON,
  PreReleaseFormData,
} from "@catalog/models/approval";
import {
  PUBLICATION_TYPE_LABELS,
  PUBLICATION_TYPES,
} from "@catalog/models/approval";
import { zodResolver } from "@hookform/resolvers/zod";
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

/** Split a comma/semicolon/newline-separated address list into trimmed entries. */
function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const CERT_MESSAGE = "All four certifications must be confirmed to submit";

const formSchema = z
  .object({
    // A — Publication details
    name: z.string().min(1, "Title is required"),
    publicationType: z.enum(PUBLICATION_TYPES),
    publicationTypeOther: z.string(),
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

    // C — Development and prior review
    reviewers: z.string(),
    stakeholderInput: z.string(),

    // D — Lead author certification
    certAccurate: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),
    certEvidence: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),
    certUncertainties: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),
    certCompliance: z.boolean().refine((v) => v, { message: CERT_MESSAGE }),

    // E — Availability and dissemination
    availableOnRelease: z.enum(["yes", "no"]),
    mediaContactName: z.string(),
    mediaContactEmail: z.string(),
    mediaContactPhone: z.string(),

    additionalRecipients: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.publicationType === "other" && !v.publicationTypeOther.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["publicationTypeOther"],
        message: "Describe the publication type",
      });
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

    const bad = parseRecipients(v.additionalRecipients).filter(
      (a) => !z.string().email().safeParse(a).success,
    );
    if (bad.length) {
      ctx.addIssue({
        code: "custom",
        path: ["additionalRecipients"],
        message: `Not valid email addresses: ${bad.join(", ")}`,
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = {
  name: "",
  publicationType: "working_paper",
  publicationTypeOther: "",
  contributors: "",
  targetReleaseDate: "",
  documentUrl: "",
  conflictsOfInterest: "",
  fundingSources: "",
  dataRestrictions: "",
  aiUsage: "none",
  reviewers: "",
  stakeholderInput: "",
  certAccurate: false,
  certEvidence: false,
  certUncertainties: false,
  certCompliance: false,
  availableOnRelease: "yes",
  mediaContactName: "",
  mediaContactEmail: "",
  mediaContactPhone: "",
  additionalRecipients: "",
};

function toFormValues(approval: ApprovalJSON): FormValues {
  const d = approval.formData;
  return {
    name: approval.name,
    publicationType: d.publicationType ?? "working_paper",
    publicationTypeOther: d.publicationTypeOther ?? "",
    contributors: d.contributors ?? "",
    targetReleaseDate: approval.targetReleaseDate ?? "",
    documentUrl: d.documentUrl ?? "",
    conflictsOfInterest: d.conflictsOfInterest ?? "",
    fundingSources: d.fundingSources ?? "",
    dataRestrictions: d.dataRestrictions ?? "",
    aiUsage: d.aiUsage ?? "none",
    reviewers: d.reviewers ?? "",
    stakeholderInput: d.stakeholderInput ?? "",
    certAccurate: d.certAccurate ?? false,
    certEvidence: d.certEvidence ?? false,
    certUncertainties: d.certUncertainties ?? false,
    certCompliance: d.certCompliance ?? false,
    availableOnRelease: d.availableOnRelease ?? "yes",
    mediaContactName: d.mediaContactName ?? "",
    mediaContactEmail: d.mediaContactEmail ?? "",
    mediaContactPhone: d.mediaContactPhone ?? "",
    additionalRecipients: (d.additionalRecipients ?? []).join(", "),
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
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
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
   * The fixed notification list, passed down from the server page so the
   * mailer module stays server-only rather than being pulled into the
   * client bundle.
   */
  standardRecipients: string[];
}) {
  const router = useRouter();
  const listHref = "/comms/pub-form";
  // After saving an edit, land back on the record you were editing rather than
  // the list — you almost always want to confirm what you just changed.
  const returnHref =
    mode === "edit" && approval ? `${listHref}/${approval.id}` : listHref;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: approval ? toFormValues(approval) : EMPTY,
  });

  const errors = form.formState.errors;
  const publicationType = form.watch("publicationType");
  const availableOnRelease = form.watch("availableOnRelease");

  async function onSubmit(values: FormValues) {
    const formData: PreReleaseFormData = {
      publicationType: values.publicationType,
      publicationTypeOther: values.publicationTypeOther.trim() || null,
      documentUrl: values.documentUrl.trim() || null,
      contributors: values.contributors,
      conflictsOfInterest: values.conflictsOfInterest,
      fundingSources: values.fundingSources,
      dataRestrictions: values.dataRestrictions,
      aiUsage: values.aiUsage,
      reviewers: values.reviewers,
      stakeholderInput: values.stakeholderInput,
      certAccurate: values.certAccurate,
      certEvidence: values.certEvidence,
      certUncertainties: values.certUncertainties,
      certCompliance: values.certCompliance,
      availableOnRelease: values.availableOnRelease,
      mediaContactName: values.mediaContactName,
      mediaContactEmail: values.mediaContactEmail,
      mediaContactPhone: values.mediaContactPhone,
      additionalRecipients: parseRecipients(values.additionalRecipients),
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <FormSection title="A. Publication details">
        <FieldGroup className="gap-4">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Title</FieldLabel>
            <Input id="name" {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>

          <div
            className={cn(
              "grid gap-4",
              publicationType === "other" && "sm:grid-cols-2",
            )}
          >
            <Field data-invalid={!!errors.publicationType}>
              <FieldLabel htmlFor="publicationType">
                Publication type
              </FieldLabel>
              <Select
                value={publicationType}
                onValueChange={(v) =>
                  form.setValue(
                    "publicationType",
                    v as FormValues["publicationType"],
                  )
                }
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

          <Field>
            <FieldLabel htmlFor="leadAuthor">Lead author</FieldLabel>
            <Input id="leadAuthor" value={authorName} disabled readOnly />
            <FieldDescription>
              Taken from your account. The lead author submits this form.
            </FieldDescription>
          </Field>

          <Field data-invalid={!!errors.contributors}>
            <FieldLabel htmlFor="contributors">
              All authors and substantial contributors
            </FieldLabel>
            <Textarea
              id="contributors"
              rows={4}
              placeholder="Names and roles; note any non-UHERO affiliations"
              {...form.register("contributors")}
            />
            <FieldError errors={[errors.contributors]} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
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
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection title="B. Disclosures">
        <FieldGroup className="gap-4">
          <Field data-invalid={!!errors.conflictsOfInterest}>
            <FieldLabel htmlFor="conflictsOfInterest">
              Conflicts of interest
            </FieldLabel>
            <Textarea
              id="conflictsOfInterest"
              rows={3}
              placeholder='Financial, personal, or professional interests that bear on the work. Enter "none" if applicable.'
              {...form.register("conflictsOfInterest")}
            />
            <FieldError errors={[errors.conflictsOfInterest]} />
          </Field>

          <Field data-invalid={!!errors.fundingSources}>
            <FieldLabel htmlFor="fundingSources">Funding source(s)</FieldLabel>
            <Textarea
              id="fundingSources"
              rows={3}
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
              rows={3}
              placeholder="Anything affecting interpretation or release"
              {...form.register("dataRestrictions")}
            />
            <FieldError errors={[errors.dataRestrictions]} />
          </Field>

          <Field data-invalid={!!errors.aiUsage}>
            <FieldLabel>Use of AI</FieldLabel>
            <RadioGroup
              value={form.watch("aiUsage")}
              onValueChange={(v) =>
                form.setValue("aiUsage", v as FormValues["aiUsage"])
              }
              className="gap-2"
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
                  AI was used, and its use followed applicable University of
                  Hawaiʻi guidance
                </FieldLabel>
              </Field>
            </RadioGroup>
            <FieldError errors={[errors.aiUsage]} />
          </Field>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection title="C. Development and prior review">
        <FieldGroup className="gap-4">
          <Field data-invalid={!!errors.reviewers}>
            <FieldLabel htmlFor="reviewers">
              Who commented on, reviewed, or contributed during development
            </FieldLabel>
            <Textarea id="reviewers" rows={3} {...form.register("reviewers")} />
            <FieldError errors={[errors.reviewers]} />
          </Field>

          <Field data-invalid={!!errors.stakeholderInput}>
            <FieldLabel htmlFor="stakeholderInput">
              Stakeholder input already sought, if any
            </FieldLabel>
            <Textarea
              id="stakeholderInput"
              rows={3}
              {...form.register("stakeholderInput")}
            />
            <FieldError errors={[errors.stakeholderInput]} />
          </Field>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection
        title="D. Lead author certification"
        description="On behalf of all authors. Confirm each — all four are required."
      >
        <FieldGroup className="gap-4">
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

          <FieldDescription>
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
        <FieldGroup className="gap-4">
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

          <div className="grid gap-4 sm:grid-cols-3">
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
        description="The standard UHERO recipients are always notified on submission."
      >
        <FieldGroup className="gap-4">
          <Field data-invalid={!!errors.additionalRecipients}>
            <FieldLabel htmlFor="additionalRecipients">
              Additional recipients
            </FieldLabel>
            <Input
              id="additionalRecipients"
              placeholder="someone@hawaii.edu, another@hawaii.edu"
              {...form.register("additionalRecipients")}
            />
            <FieldDescription>
              Comma separated. CC&apos;d on the submission email.
            </FieldDescription>
            <FieldError errors={[errors.additionalRecipients]} />
          </Field>

          <details className="text-sm">
            <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer">
              Click to see recipients
            </summary>
            <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
              {standardRecipients.map((address) => (
                <li key={address}>{address}</li>
              ))}
            </ul>
          </details>
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
