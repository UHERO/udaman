import type { ApprovalJSON } from "@catalog/models/approval";
import {
  formatAiUsageParts,
  formatPublicationType,
  formatSecondaryTypes,
} from "@catalog/models/approval";
import { Check, Square } from "lucide-react";

import { Separator } from "@/components/ui/separator";

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
function AiUsage({ d }: { d: Parameters<typeof formatAiUsageParts>[0] }) {
  const { prefix, link, suffix } = formatAiUsageParts(d);
  return (
    <>
      {prefix}
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {link.label}
        </a>
      )}
      {suffix}
    </>
  );
}

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

/** A titled block. Sections are divided by <Separator />, not cards. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function PreReleaseDetail({ approval }: { approval: ApprovalJSON }) {
  const d = approval.formData;

  return (
    <div className="space-y-6">
      <Section title="A. Publication details">
        <dl className="divide-y">
          <Row label="Title">{approval.name}</Row>
          <Row label="Primary type">{formatPublicationType(d)}</Row>
          <Row label="Secondary types">
            {formatSecondaryTypes(d.secondaryPublicationTypes)}
          </Row>
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
        </dl>
      </Section>

      <Separator />

      <Section title="B. Disclosures">
        <dl className="divide-y">
          <Row label="Conflicts of interest">{d.conflictsOfInterest}</Row>
          <Row label="Funding source(s)">{d.fundingSources}</Row>
          <Row label="Data restrictions">{d.dataRestrictions}</Row>
          <Row label="Use of AI">
            <AiUsage d={d} />
          </Row>
        </dl>
      </Section>

      <Separator />

      <Section title="C. Development and prior review">
        <dl className="divide-y">
          <Row label="Reviewers and contributors">{d.reviewers}</Row>
          <Row label="Stakeholder input">{d.stakeholderInput}</Row>
        </dl>
      </Section>

      <Separator />

      <Section title="D. Lead author certification">
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
            {approval.updatedAt && approval.updatedAt !== approval.createdAt ? (
              <Row label="Last edited">
                {formatTimestamp(approval.updatedAt)}
              </Row>
            ) : null}
          </dl>
        </div>
      </Section>

      <Separator />

      <Section title="E. Availability and dissemination">
        <dl className="divide-y">
          <Row label="Available on release day for media">
            {d.availableOnRelease === "yes" ? "Yes" : "No"}
          </Row>
          <Row label="Contact name">{d.mediaContactName}</Row>
          <Row label="Contact email">{d.mediaContactEmail}</Row>
          <Row label="Contact phone">{d.mediaContactPhone}</Row>
        </dl>
      </Section>

      <Separator />

      <Section title="Notification">
        <dl className="divide-y">
          <Row label="Notified on submission">
            {d.notifiedRecipients?.length ? (
              <details>
                <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer">
                  Click to see recipients ({d.notifiedRecipients.length})
                </summary>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
                  {d.notifiedRecipients.map((address) => (
                    <li key={address}>{address}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Row>
        </dl>
      </Section>
    </div>
  );
}
