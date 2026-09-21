# hawaiirealestatesearch.com — feasibility + field mapping

Second MLS site for the pipeline in `docs/2026-09-18-mls-scraper-plan.md`. Site key: **`hres`**.

**Status:** implemented 2026-09-19 (uncommitted) in `src/core/crawlers/mls/sites/hres/`; registered,
scheduled on the worker at 5:15 AM HST, after HiCentral. `HRES_KEY_MAP` in `parse-detail.ts` is the executable form of
the §4 table. 499 tests pass.

## 0. As built — where real pages overruled this doc

- **Board detection order:** the listing's own photos (og:image / slideshow CDN path) → a 9-digit
  number is HBR → the first board-naming disclaimer. "First disclaimer = own board" (§1) was false on
  1 of 61 pages; a 6-digit number whose only evidence says HBR throws rather than guesses.
- **TMK island digit comes from the listing's coordinates, tax-link `AppID` only as fallback.** One
  RAM listing in Kula, Maui linked to *Hawaii* County's qPublic app (agent data-entry error) — taken
  literally that yields a Big Island TMK. It was the only disagreement in 56 links. The "RAM listing
  on the Big Island" in §1 is that listing; it is on Maui. Island = `County` → TMK → coordinates.
- **RAM condos report the whole project's acreage** (12.48 ac on an 894 sf unit), so `land_area_sf`
  is NULL for RAM `Condo/Townhouse`; the raw figure stays in `extra.Acres`.
- **Any key can render as header + paragraph** when its value is long (> ~30 chars), not just the
  ones listed in §1 — handled generically.
- The three HBR renames (`Interior`/`Exterior`/`Features`) are fallbacks: HBR often prints the
  properly-named key alongside with the same value.
- `Bathrooms` `0.00` (HBR multi-family) is a blank, not zero baths. `Farm` is a Sub-Type.
- **Same property, two MLSs:** HIS 733417 and HBR 202617812 are one Big Island parcel listed on both
  boards at the same price. They remain two rows by design; `tmk` (or coordinates) is the join.
- Each island page was single-board in the sample (Oahu → HBR, Maui → RAM, Big Island/Kauai → HIS),
  but HBR-numbered neighbor-island listings do occur, so the board is still read per listing.

**Verified locally 2026-09-19:** 61-page corpus → 58 inserted + 3 deferred to HiCentral (already
owned, one row each); HiCentral then took over an `hres`-inserted HBR row in place (same `id`, same
`first_seen_at`, TMK derived from the tax link matched HiCentral's exactly), after which `hres` skips
it; live `daily --island kauai` listed 599 = the site's own count over 13 pages, 15 requests in 86 s.
Not yet seen live: a followed 301, a 404 → `off_market`, a past-the-end list page (all unit-tested).

```bash
bun run mls backfill --site hres     # after the hicentral backfill; ~9 h at the 5 s crawl delay
bun run mls daily --site hres        # what the 5:15 AM worker job runs (~25 min of list pages + new listings); keeps no HTML
bun run mls reparse --site hres
```

## 1. Can we skip Playwright? Yes.

Real Estate Webmasters (REW) PHP platform, fully server-rendered. Every URL below was fetched cold
with plain `fetch` — no cookies, no JS. Findings from 8 list pages + 88 detail pages (2026-09-19):

| | |
|---|---|
| List pages | `/mls/<island>/?p=N`, islands `oahu`, `maui` (includes Molokai, probably Lanai), `big-island`, `kauai`. **48 cards/page**, "N Properties" + "Page X of Y" on every page. `/mls/` (all islands) is 30/page *and* has a $50k price floor — the island pages are strictly better. |
| Size today | Oahu 5,759 (120 pp) · Big Island 3,215 (67) · Maui 1,875 (40) · Kauai 599 (13) → **11,448 listings, 240 list pages**. HiCentral had 73 / 201 / 33 for Maui / Hawaii / Kauai. |
| Statuses | Open only: `Active`, `Active Under Contract`. No sold listings in these feeds. |
| Detail pages | `/listing/<mls>-<address-slug>/`. ~250 KB. Data is `div.keyval > strong.keyval__key + span.keyval__val` grouped under `h2.listing-data__header`; a section with one value renders as `<p><strong>…</strong></p>` with the **section header as the key**. |
| Redirects | Slugs drift: ~⅓ of list-card links 301 to a slightly different slug. **`/listing/<mls>/` (number only) 301s to the canonical page** — so a listing can always be re-fetched by number. The fetcher follows same-origin redirects for this site. |
| robots.txt | `Crawl-delay: 5` for `*` — **honoured: 5 s + jitter, one request at a time.** `/mls/` and `/listing/` are allowed; `/mls/hicentral_sold/*`, `/idx/search`, inquiry/print pages are disallowed and not touched. |
| Boards | One combined feed (`hicentralhisramaui`) of all three MLSs. Board per listing = photo CDN path: `trestle_webapi_plus` → **HBR**, `his_acortez` → **HIS**, `ramaui` → **RAM**; fallback for a photo-less listing = the *first* `p.disclaimer` (later disclaimers belong to "similar listings" cards from other boards). Board ≠ island: the sample had an HBR and a RAM listing on the Big Island. |

**Terms of use — your call, flagging it.** Every detail page carries the standard IDX notice:
"provided exclusively for consumers' personal, non-commercial use and may not be used for any purpose
other than to identify prospective properties consumers may be interested in purchasing" (HBR and RAM
wording; HIS: "for personal, non-commercial use only"). robots.txt permits the crawl, but that notice
is narrower than what you described for HiCentral. Nothing here is republished by the pipeline; whether
internal research use is acceptable is a judgment for you / UHERO, not something I can settle from the HTML.

## 2. Cost at the mandated pace

5 s crawl delay → ~11 listings/min. **Daily:** 240 list pages ≈ 22 min + new/changed/departed details.
**Backfill:** 11.4k detail pages would be ~17 h — but ~5.7k of those are HBR listings HiCentral already
gives us in richer form (66 keys vs ~30 here). The pipeline therefore **never fetches a detail page for
a listing already owned by a higher-priority site**; it only bumps `last_seen_at`. Run the HiCentral
backfill first and this site's backfill drops to ~6k pages ≈ 9 h, nearly all neighbor-island.

## 3. Dedup

Same key as before: `(mls_board, mls_number)`. `hres` gets **priority 50** (HiCentral is 100):

- Listing on both sites → HiCentral's row wins; `hres` only touches `last_seen_at`.
- HBR listing HiCentral doesn't carry (or hasn't reached yet) → `hres` inserts it; if HiCentral later
  sees it, HiCentral overwrites and takes ownership.
- HIS / RAM listings → only `hres` has them. HIS and RAM both issue 6-digit numbers (73xxxx vs 41xxxx
  today); the board half of the key keeps them apart if the ranges ever cross.

## 4. Field mapping → `mls_listings` columns

| Their key (section) | Boards | Our column | Transform |
|---|---|---|---|
| `MLS® #` | all | `mls_number` | — |
| *(photo CDN path / first disclaimer)* | all | `mls_board` | see §1 |
| `Price` | all | `list_price` | money |
| `Status` | all | `status`, `status_raw` | same vocabulary as HiCentral |
| `Bedrooms` | all | `bedrooms` | int |
| `Full Baths` / `Half Baths` | HIS, HBR | `full_baths` / `half_baths` | int |
| `Bathrooms` (e.g. `2.50`) | all | `full_baths` / `half_baths` **only when the two above are absent** (RAM) | floor → full; `.5` → 1 half. Otherwise dropped (redundant). |
| `Square Footage` | all | `living_sf` | int |
| `Acres` | all | `land_area_sf` | × 43,560, rounded; `0.00` → NULL (condos). 2-dp acres ⇒ ±218 sf; raw kept in `extra.Acres`. |
| `Year Built` | all | `year_built` | year |
| `Type` + `Sub-Type` | all | `property_type` | Normalized to HiCentral's vocabulary: Sub-Type `Condominium`/`Townhouse` → `Condo/Townhouse`; `Single Family Residence`, `SF w/Det Ohana or Cottage` → `Single Family`; `Multi Family` → `Multi-Family`; Type `Vacant Land` → `Vacant Land`; `Commercial` → `Commercial`; `Farm` → `Farm`. **New values** vs HiCentral: Vacant Land, Commercial, Farm (HiCentral's public search has none). Raw pair kept in `extra.Type` / `extra.Sub-Type`. |
| `Land Tenure` (= `Description Land Tenure`) | all | `tenure`, `land_tenure` | `FeeSimple`/`Fee Simple` → `FS` / "Fee Simple"; `Leasehold` → `LH` / "Leasehold" |
| `Style` | HBR, RAM | `building_style` | text |
| `Assesed Value` [sic] | HIS | `assd_val_total` | money |
| `Address` | all | `address` | text |
| `Building Name` | all | `building_name` | text |
| `City` | all | `city` | text — HIS puts the *district* here ("South Hilo", "Puna") |
| `State` / `Zip Code` | all | `state` / `zip` | — |
| `Area` | HBR, RAM | `region` | text |
| `Subdivision` | all | `neighborhood` | text (HBR's value matches HiCentral's Neighborhood, e.g. `WAIKELE`) |
| `County` | HBR only | `island` | else derived from TMK (below) |
| *County Tax Information link* | 56 of 61 | `tmk` | `AppID` → island digit (1045 Honolulu=1, 1029 Maui=2, 1048 Hawaii=3, 986 Kauai=4) + 12-digit `KeyValue` `ZSPPPpppCCCC` → `I-Z-S-PPP-ppp-CCCC`. Missing link → NULL. |
| *(derived)* | — | `island` | From TMK: 1 Oahu, 3 Hawaii, 4 Kauai; 2 → Molokai (zone 5), Lanai (zone 4 sec 9), else Maui. Falls back to the island page walked. |
| `Parking Spaces` | HBR | `parking_stalls` | int |
| `Parking` / `Garages` | all | `parking_stalls_desc` | text |
| `View` | all | `view` | text |
| `Pool`, else `Has Pool` | HBR / HIS | `pool` | text; bare `Yes` when only `Has Pool` |
| `Frontage`; RAM `Waterfront` (≠ `None`) | — | `frontage` | text |
| `Floor Covering` (HIS); **`Interior`** (HBR — the values are flooring: "Carpet, Vinyl") | — | `floor_covering` | text |
| `Construction` (HIS); **`Exterior`** (HBR — "Double Wall, Concrete") | — | `construction` | text |
| `Roof` | RAM | `roofing` | text |
| `Stories` | HBR, RAM | `number_of_stories` | text |
| `Lot Description`; HBR `Features` ("Cleared, Interior Lot, Level") | — | `lot_description` | text |
| `Amenities` | HBR | `amenities` | text |
| `Appliances` | all | `inclusions` | text (HiCentral's Inclusions is the same appliance pick-list) |
| `Zoning` | HIS, some RAM | `zoning` | text |
| `Date Listed` | most | `list_date` | "September 19th, 2026" → date (ordinal suffix) |
| `Monthly Maintenance Fees` | all | `maintenance_fees` | money (arrives as `756.65`, rounded) |
| `HOA Fees` | HBR, RAM | `association_fees` | money |
| `Monthly Lease Fee(s)` | RAM | `lease_rent` | text |
| `Lease Expires` | RAM | `lease_exp` | text |
| `Elementary` / `Middle` / `High` | HBR | `elem_school` / `middle_school` / `high_school` | text |
| `Office` | all | `listing_office` | text |
| `data-listing` geo | all | `extra.Latitude` / `extra.Longitude` | **No column today — worth promoting**; every listing has coordinates. |
| `Washer / Dryer`, `Interior Features`, `Exterior Features`, `Heating`, `Cooling`, `Windows`, `Foundation`, `Utilities`, `Fireplace(s)`, `# of Garages`, `CPR Land Acres`, `HOA Fees Freq.` | mixed | `extra` | verbatim |
| `Days on Market` | most | **dropped** | Changes daily; keeping it would mark every row "updated" every day. `first_seen_at` / `list_date` give the same thing. |
| `Office Contact` | HBR, RAM | **dropped** | agent phone numbers — same rule as HiCentral |

**Not available on this site** (stay NULL): `sold_price`, `date_sold`, `remarks` (the detail page only
has an auto-generated blurb; the agent's remarks appear solely on list cards, which aren't a stable
source for reparse), `listing_agent`, `lanai_sf`, `other_sf`, `year_remodeled`, `assd_val_land`,
`assd_val_imprv`, `tax_year`, `monthly_taxes`, `home_exempt`, `furnished`, `security`, `disclosures`,
`possession`, `terms_accept`, `land_recorded`, `easements`, `set_backs`, unit mix, `open_house`.

## 5. What changes in the shared pipeline

- `SiteAdapter.boards[]` replaces `board`; `ListRow.mlsBoard` (nullable) and `ListRow.detailUrl`.
- Known-listing lookups keyed by `board:number` with owner site + priority, so a lower-priority site
  skips the detail fetch for listings a better site owns.
- `ListRow.status: "unknown"` no longer forces a refetch (this site's cards don't show status).
- Fetcher: opt-in same-origin redirect following (each hop a full, delayed request; max 3), and
  opt-in `goneStatuses` (404 here) returned as `{ kind: "gone" }` instead of counting as a failure.
- `walkFor()`: Molokai/Lanai rows are covered by the `maui` walk for the departed check.
- Sold/closed detection works as before: a listing absent from the walk is re-fetched by number; a
  removed listing answers **HTTP 404 "Listing Not Found"** (verified) → `off_market`. (HiCentral says
  the same thing with a 200; the fetcher now has an opt-in "these statuses mean gone".) This site never reports a sold price, so
  HIS/RAM listings end as `off_market`, not `sold`.
