# DCCA condo register → condominium_projects — 2026-09-23

`bun run dcca` scrapes the DCCA Real Estate Branch condo register and writes
its fields onto `condominium_projects`. It replaces the one-off load that
populated the `dcca_*` / developer / unit-mix columns from the old DPR.Net
site (`ShowPublic.aspx?PROJTEXT=…`), which no longer exists.

Code: `src/core/crawlers/dcca/`, CLI `src/core/workers/dcca-cli.ts`.

## The source

| Page    | URL                                                       | Notes                                                                                                                                                         |
| ------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Index   | `https://web3.dcca.hawaii.gov/reb/public/result?search=`  | One 2.4 MB page, every project. 9,279 rows → 9,231 distinct registration numbers (a project can be listed twice with a name variant such as "… (514B, HRS)"). |
| Profile | `https://web3.dcca.hawaii.gov/reb/public/result2?reg=<n>` | ~6 KB. One `<pre>` of `Label   <em>value</em>` lines plus a table of filed PDFs. Unknown `reg` → same page with no `<pre>`.                                   |

Profile fields (2026-09): Registration Number, Project Name, Project Address
(street / city / state / zip as four `<em>`s), Developer(s), Zoning, TMK,
Buildings, Floors, Total Units, Residential, Commercial, Agricultural,
Parking, Tool Sheds, Other, Ohana, Converted, Land Ownership. Any label the
parser does not know is kept in `extra` and listed in the run summary as
`unknownLabels`, so a new field shows up instead of vanishing.

**Not published any more:** the four registration dates
(`preliminary_date`, `contingent_final_date`, `final_date`,
`biennial_registration_date`). Those columns keep whatever the DPR.Net load
left and are never written by this pipeline.

**TMK:** printed as 9 digits with the county digit and no CPR
(`247009031`). `expandTmk` makes the DB form `2-4-7-009-031-0000`. The
register's TMK is sometimes wrong, and its project names differ from the
county's, which is why matching is more than a key lookup (below).

**Land ownership:** the register prints a phrase (`FEE SIMPLE`, …) where
DPR.Net used codes (`FO`, `L`, `FC`, …). The column is widened to
VARCHAR(50) — `migrations/2026-09-22-widen-condo-land-ownership.sql` for the
remote, and `hhdb-schema.sql` for the rebuild. Rows the register matches get
the phrase; rows it does not match keep their code.

## Running it

```
bun run dcca run                 # list → profiles → load
bun run dcca list                # index page → runs/<date>-list.json
bun run dcca profiles            # every profile not yet cached (~3 h first time)
bun run dcca load [--dry-run]    # parse cache, match, write, report
```

Options: `--dry-run`, `--local` (write the local rebuild DB instead of the
remote), `--insert-new`, `--refetch`, `--max <n>`, `--date <YYYY-MM-DD>`.

HTML is cached on the NAS under `work/scrapes/dcca/` (`DCCA_NAS_PATH`
overrides; a temp dir is used when the NAS is not mounted):

```
index/<date>.html            the whole register, one per day
profiles/<reg>/<date>.html   dated snapshots; the newest is what load reads
runs/<date>-list.json        registration list from that day's index
runs/<date>-report.csv       one line per profile: outcome + what it matched
```

Every stage is rerunnable: `profiles` skips cached pages (so an interrupted
first run just continues), and `load` rewrites the same values.

### When to rerun

- **After every qpub sync.** `condominium_projects` is a pipeline table:
  the sync recreates it from the local rebuild DB, which never has these
  fields. `bun run dcca load` (no network) puts them back in a few seconds.
- **Periodically** (`bun run dcca run`, or `profiles --refetch` for a full
  refresh) to pick up new registrations.

## Matching

For each profile, in order:

1. **TMK** — the register's TMK expanded to a dashed parent parcel matches a
   `condominium_projects.tmk`. The report notes when the names disagree.
2. **Name** — otherwise, the normalized name (upper case; quotes, okina,
   punctuation and statute tags removed; CONDOMINIUM / PROJECT / THE / INC /
   PHASE / … dropped) matches exactly one row. If several rows share the
   name, candidates are narrowed to the register TMK's island, then to the
   row whose `unit_count` equals the register's Total Units. Still several →
   `ambiguous`, nothing written.
3. **None** — `unmatched`; or `insertable` when the TMK is a real parcel
   (exists in `properties`) with no condo row. `--insert-new` creates such
   rows (name and unit count from the register); off by default because a
   wrong register TMK would attach a condo record to the wrong parcel.

A row claimed by several profiles (re-registrations, wrong TMKs) goes to the
best claim — TMK+name, then TMK, then name, then the newer registration —
and the others are reported as `superseded`.

The report's `outcome` column is one of: updated, would-update, inserted,
would-insert, superseded, unmatched, ambiguous, no-tmk, insertable,
not-found, parse-error. Sort by `outcome` to see what needs a human.

## Verified

- Parsers against saved fixtures (`fixtures/`): full profile, quoted name +
  empty zip, `&` in the street, not-found page, the duplicated index row.
- Live (2026-09-23): index (9,231 projects) and five profiles fetched into a
  scratch cache; `load --dry-run` then `load` against the local copy of the
  housing DB matched all eight cached profiles by TMK and rewrote their rows.
  Two of the eight matched a row whose county name differs (e.g. register
  6368 "WIEST CONDOMINIUM" → parcel 2-4-7-009-031 "ARAKAKI FAMILY
  CONDOMINIUM", which the register also lists as 5573). In a full run both
  profiles claim that row and the name-agreeing one (5573) wins; the other is
  reported `superseded`.
