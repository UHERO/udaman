import type { ApprovalJSON, PublicationType } from "@catalog/models/approval";
import { PUBLICATION_TYPE_LABELS } from "@catalog/models/approval";
import { Check, Square } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Render a `YYYY-MM-DD` string without letting the local timezone shift the day. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  return `${new Date(value).toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    dateStyle: "long",
    timeStyle: "short",
  })} HST`;
}

/**
 * One label/value pair. Mirrors the row layout of the notification email so a
 * reviewer reading the page and a reviewer reading the email see the same
 * document. Disclosure text keeps its line breaks.
 */
function Row({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  const empty =
    children === null ||
    children === undefined ||
    (typeof children === "string" && !children.trim());

  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[220px_1fr] sm:gap-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm whitespace-pre-wrap">
        {empty ? <span className="text-muted-foreground">—</span> : children}
      </dd>
    </div>
  );
}

function CheckRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {checked ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
      ) : (
        <Square className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">{children}</dl>
      </CardContent>
    </Card>
  );
}

export function PreReleaseDetail({ approval }: { approval: ApprovalJSON }) {
  const d = approval.formData;

  const publicationType =
    PUBLICATION_TYPE_LABELS[d.publicationType as PublicationType] ??
    d.publicationType;
  const publicationTypeLabel =
    d.publicationType === "other" && d.publicationTypeOther
      ? `${publicationType} — ${d.publicationTypeOther}`
      : publicationType;

  return (
    <div className="space-y-4">
      <Section title="A. Publication details">
        <Row label="Title">{approval.name}</Row>
        <Row label="Publication type">{publicationTypeLabel}</Row>
        <Row label="Lead author">{approval.author}</Row>
        <Row label="All authors and contributors">{d.contributors}</Row>
        <Row label="Target release date">
          {formatDate(approval.targetReleaseDate)}
        </Row>
        <Row label="Link to draft">
          {d.documentUrl ? (
            <a
              href={d.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ublue break-all underline underline-offset-2"
            >
              {d.documentUrl}
            </a>
          ) : null}
        </Row>
      </Section>

      <Section title="B. Disclosures">
        <Row label="Conflicts of interest">{d.conflictsOfInterest}</Row>
        <Row label="Funding source(s)">{d.fundingSources}</Row>
        <Row label="Data restrictions">{d.dataRestrictions}</Row>
        <Row label="Use of AI">
          {d.aiUsage === "none"
            ? "No AI was used in preparing the work"
            : "AI was used; its use followed applicable University of Hawaiʻi guidance"}
        </Row>
      </Section>

      <Section title="C. Development and prior review">
        <Row label="Reviewers and contributors">{d.reviewers}</Row>
        <Row label="Stakeholder input">{d.stakeholderInput}</Row>
      </Section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            D. Lead author certification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            <CheckRow
              label="The work is accurate, has integrity, and is appropriately presented, including any AI-assisted content."
              checked={d.certAccurate}
            />
            <CheckRow
              label="The evidence and methods support the conclusions."
              checked={d.certEvidence}
            />
            <CheckRow
              label="Uncertainties, assumptions, and limitations are clearly stated."
              checked={d.certUncertainties}
            />
            <CheckRow
              label="The work complies with applicable UH policies, research protocols, disclosure requirements, and professional standards."
              checked={d.certCompliance}
            />
            <dl>
              <Row label="Certified by">
                {approval.author}
                {formatTimestamp(approval.createdAt)
                  ? ` — ${formatTimestamp(approval.createdAt)}`
                  : ""}
              </Row>
              {approval.updatedAt &&
              approval.updatedAt !== approval.createdAt ? (
                <Row label="Last edited">
                  {formatTimestamp(approval.updatedAt)}
                </Row>
              ) : null}
            </dl>
          </div>
        </CardContent>
      </Card>

      <Section title="E. Availability and dissemination">
        <Row label="Available on release day for media">
          {d.availableOnRelease === "yes" ? "Yes" : "No"}
        </Row>
        <Row label="Contact name">{d.mediaContactName}</Row>
        <Row label="Contact email">{d.mediaContactEmail}</Row>
        <Row label="Contact phone">{d.mediaContactPhone}</Row>
      </Section>

      <Section title="Notification">
        <Row label="Notified on submission">
          {d.notifiedRecipients?.length
            ? d.notifiedRecipients.join(", ")
            : null}
        </Row>
      </Section>
    </div>
  );
}
