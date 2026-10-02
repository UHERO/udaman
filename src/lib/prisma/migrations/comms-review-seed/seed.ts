/**
 * Comms Review Seed Script
 *
 * Populates the pre-release approvals + reviews tables with realistic
 * sample data so the comms review kanban board has enough cards to work
 * with locally: ~10 approvals spanning UHERO's real publication types,
 * each carrying 2-4 reviewer rows with descriptive notes and a mix of
 * board statuses/attestation states.
 *
 * Existing `[SAMPLE]` rows from a prior run are deleted first so the script
 * is idempotent — re-running it always leaves exactly this data set.
 *
 * Run: bun run src/lib/prisma/migrations/comms-review-seed/seed.ts [--execute]
 *
 * Without --execute, runs in dry-run mode (prints what would be created).
 */

import { rawQuery } from "@/lib/mysql/db";

const DRY_RUN = !process.argv.includes("--execute");
const SAMPLE_PREFIX = "[SAMPLE] ";

// ─── Helpers ─────────────────────────────────────────────────────────

async function insert(sql: string, params: unknown[]): Promise<number> {
  await rawQuery(sql, params as (string | number | Date)[]);
  const rows = await rawQuery<{ id: number }>("SELECT LAST_INSERT_ID() as id");
  return rows[0].id;
}

async function findUserId(email: string): Promise<number | null> {
  const rows = await rawQuery<{ id: number }>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0]?.id ?? null;
}

// ─── Cast, all UHERO staff who already exist in the dev DB ──────────

const AUTHOR_EMAIL = "dangg@hawaii.edu";

const REVIEWER_EMAILS = [
  "james29@hawaii.edu",
  "gangnes@hawaii.edu",
  "kburnett@hawaii.edu",
  "cawada@hawaii.edu",
  "bondsmit@hawaii.edu",
  "vward@hawaii.edu",
  "fuleky@hawaii.edu",
  "bonham@hawaii.edu",
  "ashleysh@hawaii.edu",
];

// ─── Sample form bodies ──────────────────────────────────────────────

type ReviewSeed = {
  reviewerEmail: string;
  boardStatus: "not_started" | "in_progress" | "needs_changes" | "reviewed";
  /** Days before "now" the review's note was left, for created_at ordering. */
  daysAgo: number;
  attested: boolean;
  notes: string | null;
};

type ApprovalSeed = {
  name: string;
  publicationType:
    | "briefs"
    | "insights"
    | "forecast"
    | "working_paper"
    | "publication"
    | "focus_video"
    | "report";
  targetReleaseInDays: number;
  contributors: string;
  fundingSources: string;
  dataRestrictions: string;
  stakeholderInput: string;
  mediaContactName: string;
  mediaContactEmail: string;
  reviews: ReviewSeed[];
};

const APPROVALS: ApprovalSeed[] = [
  {
    name: "Q3 2026 Housing Forecast Brief",
    publicationType: "forecast",
    targetReleaseInDays: 12,
    contributors: "Justin Tyndall, Rachel Inafuku",
    fundingSources: "State of Hawaii DBEDT contract",
    dataRestrictions: "None",
    stakeholderInput: "Draft circulated to DBEDT housing policy team on 9/2.",
    mediaContactName: "Justin Tyndall",
    mediaContactEmail: "jtyndall@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "gangnes@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 3,
        attested: true,
        notes:
          "Methodology section reads clearly and the permit-lag chart matches what I remember from last quarter's data pull. One nit: the median price table on page 4 still says '2025Q4' in the header when it should be '2026Q2' — looks like a copy-paste leftover from the template. Otherwise ready to go.",
      },
      {
        reviewerEmail: "kburnett@hawaii.edu",
        boardStatus: "needs_changes",
        daysAgo: 2,
        attested: false,
        notes:
          "The Oahu single-family median price growth rate in the executive summary (6.2%) doesn't match the 5.8% figure in Table 2 — please reconcile before this goes out. Also, the Neighbor Island section is missing a citation for the Maui County building permit data; I couldn't tell if that came from the county or from our own HHF pull.",
      },
      {
        reviewerEmail: "james29@hawaii.edu",
        boardStatus: "in_progress",
        daysAgo: 1,
        attested: false,
        notes:
          "About halfway through — checking the interest rate assumptions against the Fed's latest dot plot before signing off. Will have comments by end of day tomorrow.",
      },
    ],
  },
  {
    name: "UHERO Economic Outlook Update — September",
    publicationType: "publication",
    targetReleaseInDays: 5,
    contributors: "Byron Gangnes, Peter Fuleky, Carl Bonham",
    fundingSources: "None",
    dataRestrictions: "None",
    stakeholderInput: "Reviewed internally at the 9/8 UHERO staff meeting.",
    mediaContactName: "Byron Gangnes",
    mediaContactEmail: "gangnes@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "cawada@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 4,
        attested: true,
        notes:
          "Tourism arrivals section is solid and the seasonally-adjusted numbers tie out to the DBEDT visitor stats release. Nice job tightening the intro — much easier to skim than last quarter's version.",
      },
      {
        reviewerEmail: "bondsmit@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 3,
        attested: true,
        notes:
          "GET revenue projections check out against the CAFR figures I have on hand. No changes needed from a fiscal-policy read.",
      },
      {
        reviewerEmail: "vward@hawaii.edu",
        boardStatus: "needs_changes",
        daysAgo: 1,
        attested: false,
        notes:
          "The employment chart on page 2 is using NAICS supersector labels but the legend still has the old BLS category names — will confuse readers who cross-reference against the DLIR release. Can send you the updated label mapping if that's faster than redoing it yourself.",
      },
    ],
  },
  {
    name: "Maui Wildfire Recovery: One-Year Housing Impact",
    publicationType: "briefs",
    targetReleaseInDays: 20,
    contributors: "Justin Tyndall, Sally Pham",
    fundingSources: "County of Maui / State recovery office grant",
    dataRestrictions:
      "Individual parcel-level data redacted per county data-sharing agreement.",
    stakeholderInput:
      "Shared with Maui County Office of Recovery for factual review on 8/28.",
    mediaContactName: "Justin Tyndall",
    mediaContactEmail: "jtyndall@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "kburnett@hawaii.edu",
        boardStatus: "in_progress",
        daysAgo: 1,
        attested: false,
        notes:
          "Sensitive topic given the anniversary timing, so I'm being thorough. So far the displacement estimates look reasonable, but I want to double check the rental vacancy figure against the latest Maui listings data before signing off — it seems low compared to what agents have told me anecdotally.",
      },
      {
        reviewerEmail: "ashleysh@hawaii.edu",
        boardStatus: "not_started",
        daysAgo: 0,
        attested: false,
        notes: null,
      },
    ],
  },
  {
    name: "Focus: Understanding Hawaii's Labor Force Participation Gap",
    publicationType: "focus_video",
    targetReleaseInDays: 8,
    contributors: "Peter Fuleky, video production by UH Manoa media services",
    fundingSources: "None",
    dataRestrictions: "None",
    stakeholderInput: "None",
    mediaContactName: "Peter Fuleky",
    mediaContactEmail: "fuleky@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "bonham@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 5,
        attested: true,
        notes:
          "Script is accurate and the pacing works well for a 4-minute video. Appreciated that we called out the caregiving-related labor force exits explicitly instead of just citing the aggregate participation rate — that's the nuance people usually miss.",
      },
      {
        reviewerEmail: "gangnes@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 4,
        attested: true,
        notes: "Numbers match the Q2 labor force release. Good to publish.",
      },
    ],
  },
  {
    name: "Working Paper: Short-Term Rental Regulation and Long-Term Rents",
    publicationType: "working_paper",
    targetReleaseInDays: 30,
    contributors: "Rachel Inafuku, Justin Tyndall",
    fundingSources: "National Science Foundation grant #2214xxx",
    dataRestrictions:
      "Uses licensed AirDNA data; aggregated tables only in the public release.",
    stakeholderInput:
      "Presented at the Western Economic Association meeting, July 2026; comments incorporated.",
    mediaContactName: "Rachel Inafuku",
    mediaContactEmail: "rinafuku@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "gangnes@hawaii.edu",
        boardStatus: "needs_changes",
        daysAgo: 6,
        attested: false,
        notes:
          "The identification strategy write-up in Section 3 needs another pass — as written it's not clear why the 2019 regulatory change is a valid instrument versus just a coincident trend break. Suggest adding the placebo test from the appendix into the main text since reviewers will ask about it anyway.",
      },
      {
        reviewerEmail: "bonham@hawaii.edu",
        boardStatus: "in_progress",
        daysAgo: 2,
        attested: false,
        notes:
          "Reading through the empirical results now. The magnitude of the rent effect in Table 5 seems large relative to the mainland literature — want to check the standard errors are clustered correctly before commenting further.",
      },
      {
        reviewerEmail: "kburnett@hawaii.edu",
        boardStatus: "not_started",
        daysAgo: 0,
        attested: false,
        notes: null,
      },
    ],
  },
  {
    name: "Insights: Construction Cost Index Rebased to 2026",
    publicationType: "insights",
    targetReleaseInDays: 3,
    contributors: "Byron Gangnes",
    fundingSources: "None",
    dataRestrictions: "None",
    stakeholderInput: "None",
    mediaContactName: "Byron Gangnes",
    mediaContactEmail: "gangnes@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "cawada@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 1,
        attested: true,
        notes:
          "Rebasing methodology matches what we agreed on in the June planning doc. Charts render correctly and the historical series still lines up at the splice point.",
      },
      {
        reviewerEmail: "vward@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 1,
        attested: true,
        notes:
          "Confirmed the new base year weights against BLS input costs. Approved.",
      },
    ],
  },
  {
    name: "Report: Neighbor Island Visitor Spending Patterns 2026",
    publicationType: "report",
    targetReleaseInDays: 15,
    contributors: "Sally Pham, Steven Bond-Smith",
    fundingSources: "Hawaii Tourism Authority",
    dataRestrictions: "None",
    stakeholderInput: "Draft reviewed by HTA research staff on 8/30.",
    mediaContactName: "Steven Bond-Smith",
    mediaContactEmail: "bondsmit@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "james29@hawaii.edu",
        boardStatus: "needs_changes",
        daysAgo: 2,
        attested: false,
        notes:
          "Kauai spending-per-visitor figure in Table 3 looks like it's still in nominal dollars while every other island in the same table is inflation-adjusted — that's going to produce a misleading cross-island comparison if it ships as-is. Everything else checks out.",
      },
      {
        reviewerEmail: "ashleysh@hawaii.edu",
        boardStatus: "in_progress",
        daysAgo: 1,
        attested: false,
        notes:
          "Cross-checking the HTA-reported spending totals against our own visitor expenditure series before I sign off — there's a ~4% gap I want to understand first.",
      },
    ],
  },
  {
    name: "Briefs: Interest Rate Sensitivity of Hawaii Home Sales",
    publicationType: "briefs",
    targetReleaseInDays: 7,
    contributors: "Justin Tyndall",
    fundingSources: "None",
    dataRestrictions: "None",
    stakeholderInput: "None",
    mediaContactName: "Justin Tyndall",
    mediaContactEmail: "jtyndall@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "kburnett@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 2,
        attested: true,
        notes:
          "Clear, well-scoped brief. The mortgage rate lock-in explanation for the sales slowdown is easy to follow for a non-technical reader. No changes needed.",
      },
      {
        reviewerEmail: "gangnes@hawaii.edu",
        boardStatus: "not_started",
        daysAgo: 0,
        attested: false,
        notes: null,
      },
    ],
  },
  {
    name: "Publication: 2026 State of Hawaii Economic Outlook (Annual)",
    publicationType: "publication",
    targetReleaseInDays: 45,
    contributors: "Full UHERO research team",
    fundingSources: "State of Hawaii general appropriation",
    dataRestrictions: "None",
    stakeholderInput:
      "Chapter drafts circulated to all contributing authors throughout August.",
    mediaContactName: "Carl Bonham",
    mediaContactEmail: "bonham@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "fuleky@hawaii.edu",
        boardStatus: "in_progress",
        daysAgo: 3,
        attested: false,
        notes:
          "Working through the macro forecast chapter first since the other chapters depend on those baseline assumptions. GDP growth path looks reasonable but I want to reconcile the tourism recovery assumption with the separate visitor industry chapter before either goes final.",
      },
      {
        reviewerEmail: "gangnes@hawaii.edu",
        boardStatus: "not_started",
        daysAgo: 0,
        attested: false,
        notes: null,
      },
      {
        reviewerEmail: "bondsmit@hawaii.edu",
        boardStatus: "not_started",
        daysAgo: 0,
        attested: false,
        notes: null,
      },
      {
        reviewerEmail: "cawada@hawaii.edu",
        boardStatus: "needs_changes",
        daysAgo: 1,
        attested: false,
        notes:
          "Neighbor island chapter cites 2025 population estimates but the statewide chapter already switched to the revised 2026 vintage — needs to be consistent across chapters or reviewers will flag the discrepancy immediately.",
      },
    ],
  },
  {
    name: "Insights: What the New Federal Rate Path Means for Hawaii Borrowers",
    publicationType: "insights",
    targetReleaseInDays: 2,
    contributors: "Peter Fuleky",
    fundingSources: "None",
    dataRestrictions: "None",
    stakeholderInput: "None",
    mediaContactName: "Peter Fuleky",
    mediaContactEmail: "fuleky@hawaii.edu",
    reviews: [
      {
        reviewerEmail: "bonham@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 1,
        attested: true,
        notes:
          "Timely and accurate given yesterday's FOMC statement. Double-checked the local mortgage rate pass-through assumption — matches what we've published before. Ready to release ahead of the news cycle.",
      },
      {
        reviewerEmail: "vward@hawaii.edu",
        boardStatus: "reviewed",
        daysAgo: 0,
        attested: true,
        notes: "Quick turnaround piece, reads well, no factual issues found.",
      },
    ],
  },
];

// ─── Main seed logic ─────────────────────────────────────────────────

async function seed() {
  console.log(`Comms Review Seed ${DRY_RUN ? "(DRY RUN)" : "(EXECUTING)"}`);
  console.log("─".repeat(60));

  const totalReviews = APPROVALS.reduce((n, a) => n + a.reviews.length, 0);
  console.log(`Approvals to create: ${APPROVALS.length}`);
  console.log(`Reviews to create: ${totalReviews}`);
  console.log("─".repeat(60));

  if (DRY_RUN) {
    for (const a of APPROVALS) {
      console.log(`\n${SAMPLE_PREFIX}${a.name} (${a.publicationType})`);
      for (const r of a.reviews) {
        console.log(
          `  - ${r.reviewerEmail}: ${r.boardStatus}${r.attested ? " [attested]" : ""}${r.notes ? ` — "${r.notes.slice(0, 60)}..."` : ""}`,
        );
      }
    }
    console.log("\nRun with --execute to create these records.");
    return;
  }

  const authorId = await findUserId(AUTHOR_EMAIL);
  if (!authorId) {
    throw new Error(`Author ${AUTHOR_EMAIL} not found — seed users first.`);
  }

  const reviewerIds = new Map<string, number>();
  for (const email of REVIEWER_EMAILS) {
    const id = await findUserId(email);
    if (!id) throw new Error(`Reviewer ${email} not found — seed users first.`);
    reviewerIds.set(email, id);
  }

  // Idempotent: clear out any previous run's sample rows first (cascades to reviews).
  const deleted = await rawQuery<{ id: number }>(
    "SELECT id FROM approvals WHERE name LIKE ?",
    [`${SAMPLE_PREFIX}%`],
  );
  if (deleted.length) {
    await rawQuery("DELETE FROM approvals WHERE name LIKE ?", [
      `${SAMPLE_PREFIX}%`,
    ]);
    console.log(`Cleared ${deleted.length} previous sample approval(s).`);
  }

  let approvalsCreated = 0;
  let reviewsCreated = 0;

  for (const a of APPROVALS) {
    const formData = {
      publicationType: a.publicationType,
      publicationTypeOther: null,
      secondaryPublicationTypes: [],
      documentUrl: null,
      contributors: a.contributors,
      conflictsOfInterest: "None",
      fundingSources: a.fundingSources,
      dataRestrictions: a.dataRestrictions,
      aiUsage: "none",
      aiUses: [],
      aiUsageOther: null,
      reviewers: a.reviews.map((r) => r.reviewerEmail).join(", "),
      stakeholderInput: a.stakeholderInput,
      certAccurate: true,
      certEvidence: true,
      certUncertainties: true,
      certCompliance: true,
      certIndependent: true,
      availableOnRelease: "yes",
      mediaContactName: a.mediaContactName,
      mediaContactEmail: a.mediaContactEmail,
      mediaContactPhone: "808-956-2325",
      recipients: [AUTHOR_EMAIL],
      notifiedRecipients: [AUTHOR_EMAIL],
    };

    const approvalId = await insert(
      `INSERT INTO approvals
         (type, universe, name, author, author_user_id, target_release_date, form_data, created_at, updated_at)
       VALUES ('pre_release', 'UHERO', ?, ?, ?,
         DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, NOW(), NOW())`,
      [
        `${SAMPLE_PREFIX}${a.name}`,
        AUTHOR_EMAIL,
        authorId,
        a.targetReleaseInDays,
        JSON.stringify(formData),
      ],
    );
    approvalsCreated++;

    for (const r of a.reviews) {
      const reviewerId = reviewerIds.get(r.reviewerEmail)!;
      await insert(
        `INSERT INTO approval_reviews
           (approval_id, reviewer_user_id, reviewer, attested, reviewed_at, notes, board_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?,
           DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [
          approvalId,
          reviewerId,
          r.reviewerEmail,
          r.attested ? 1 : 0,
          r.attested ? new Date() : null,
          r.notes,
          r.boardStatus,
          r.daysAgo,
          r.daysAgo,
        ] as (string | number | Date)[],
      );
      reviewsCreated++;
    }

    console.log(
      `Created "${a.name}" (id=${approvalId}) with ${a.reviews.length} review(s)`,
    );
  }

  console.log("\n" + "─".repeat(60));
  console.log("Comms Review Seed complete.");
  console.log(`  Approvals: ${approvalsCreated}`);
  console.log(`  Reviews: ${reviewsCreated}`);
}

seed()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nSEED FAILED:", err);
    process.exit(1);
  });
