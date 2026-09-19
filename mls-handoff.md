# HiCentral (Honolulu Board of REALTORS®) scrape — feasibility findings

**Date:** 2026-09-18
**Question asked:** can we fetch + parse these list pages, or do we need Playwright?
**Answer: plain `fetch` is enough. No browser, no Playwright, no JS execution, no session cookie.**

This phase only validated step 1 (fetch list pages → collect listing URLs). The detail-page
shape was confirmed too, but no detail scraping or DB work was built.

---

## 1. What the site actually is

`propertysearch.hicentral.com/HBR/ForSale/` is a classic **ASP.NET WebForms** app.

- Results are **fully server-rendered** into the initial HTML response.
- There is **no XHR/JSON API** behind the results — the listings are in the HTML document.
- `__VIEWSTATE` is present but **not required for GET navigation**. Every URL below was fetched
  cold: no cookies, no referer, no `User-Agent`, no prior request. All returned 200 with data.
- `robots.txt` disallows only `SemrushBot`. Nothing here is disallowed for us.

Because of this, HTML parsing is the whole job. Bun's built-in `HTMLRewriter` handles it —
no cheerio/jsdom dependency needed.

## 2. URL structure (the important part)

Criteria are encoded as **slash-delimited positional segments inside the query string**, not as
`key=value` pairs. Example from `index.json`:

```
https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////1////////////////////////////
                                                  └0──┘ └1──────────┘│ │ │ │ │        │
```

Split the part after `?` on `/`. Meaningful indices confirmed by experiment:

| index | meaning | values seen |
|---|---|---|
| 1 | page type | `Results` |
| 2 | search type | `Neighborhood` |
| 3 | sort | `""` = Price (High), `pl` = Price (Low), `d` = Date (Newest) |
| 4 | **page number** | `""` for page 1, else `2`, `3`, … |
| 5 | (island/region related) | `7` |
| 7 | **status bitmask** | see below |

Everything else is empty padding in these particular URLs. **Do not assume the trailing slash
count is significant** — the site's own "Next" link emits a different number of trailing slashes
than the seed URLs and both work.

### Status bitmask (segment 7)

Read straight off the page's `<select name="ctl00$main$ctl00$ddlStatus">`:

| value | status | Oahu count |
|---|---|---|
| 128 | Active | 3,626 |
| 16 | Active Under Contract | 870 |
| 1 | Pending | 170 |
| 256 | Sold | 15,960 |
| **401** | Any (128+256+16+1) | 20,626 |

The seed URLs in `index.json` all use `401` (everything, including 15,960 sold listings).
**Setting segment 7 to `128` gives active-only**, verified: 3,626 results. OR the values together
for any combination.

URL for each island's list page
```
 {
    "oahu": "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////1////////////////////////////",
    "kauai": "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////4/15///////////////////////////",
    "maui": "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////2/19///////////////////////////",
    "lanai": "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////6/28///////////////////////////",
    "molokai": "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////5/96///////////////////////////",
    "hawaii": "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////3////////////////////////////"
}
```

## 3. Pagination

- Fixed **20 listings per page**. No page-size parameter was found.
- Pagination is **stateless** — you can jump straight to page 400 cold and get rows 7,981–8,000.
  No need to walk pages in order, so this parallelizes freely.
- **Hard cap at page 498** (~9,960 rows). Verified precisely:
  - page 498 → `Showing 9941 - 9960` ✅
  - page 499 → returns a 20,815-byte "no results" page, 0 listings ❌
  - Every page ≥ 499 (tested up to 1032) returns that same empty page.
- Consequence: **one search URL can never yield more than ~9,960 of Oahu's 20,626 rows.**

**This cap was deemed acceptable.** Page 499 at default sort reaches back to 2024 MLS numbers,
which is far enough. For context, the site's own UI only exposes pages 1–10.

If full coverage is ever needed, slice the search so each slice is under 9,960 — the status
bitmask is the natural axis (active 3,626 / sold 15,960 would still need splitting, e.g. by
price band or region).

## 4. Extracting listing URLs

Detail links in the results HTML are **bare relative hrefs containing only the MLS number**:

```html
<a href="?/202426768">202426768</a>
```

Selector `a` + regex `/^\?\/\d{9}$/` on the href. 20 per page, deduped. The absolute detail URL is:

```
https://propertysearch.hicentral.com/HBR/ForSale/?/<MLS#>
```

Result count comes from:
```html
<b>Results:</b> &nbsp;Showing <b>1 - 20</b> of <b>20626</b>
```

## 5. Detail pages (confirmed, not built)

Detail pages fetch fine with the same bare `fetch` (200, ~39KB).

**Important for step 3: the data is NOT in `<table>` elements.** The page has zero `<table>` tags.
It's **definition lists** — 14 `<dl>`, 52 `<dt>`/`<dd>` pairs:

```html
<dt>Property Type:</dt>
<dd><strong>Single Family</strong></dd>
<dt>Land Area (sf): </dt>
<dd>33,018</dd>
```

A `dt`/`dd` pair-walk yields ~51–54 clean key/value fields per listing. Observed keys include:
`MLS #`, `Island`, `Region`, `Neighborhood`, `TMK`, `List Date`, `Date Sold`, `Zoning`,
`Property Type`, `Bedrooms`, `Full Baths`, `Half Baths`, `Land Area (sf)`, `Living (sf)`,
`Lanai (sf)`, `Other (sf)`, `Parking Stalls`, `Year Built`, `Year Remodeled`, `Furnished`,
`Assd. Val. Land`, `Assd. Val. Imprv`, `Assd. Val. Total`, `Tax Year`, `Monthly Taxes`,
`Home Exempt.`, `Elem. School`, `Middle School`, `High School`, `Frontage`, `View`.

Notes for the schema work:
- **Field count varies per listing** (51–54 observed) — treat as a sparse key/value bag, not a
  fixed-width row. Don't assume every key is present.
- Missing values come through as the literal string `"--"`, not empty. Normalize these to NULL.
- Numbers arrive formatted: `"33,018"`, `"$18,500,000"`, `"$18,500,000 (FS)"` (FS = fee simple,
  vs LH leasehold — worth parsing the tenure out as its own column).
- Dates are long-form: `"December 31, 2024"`.
- Trailing colons and trailing spaces on keys (`"Bedrooms: "`) need stripping.
- Listing photos are on S3: `//s3.amazonaws.com/photos.re.parallel21.com/<nn>/<MLS>_00.jpg`.

## 6. Performance / politeness

Measured, cold, from a laptop:

- List page: ~350–500ms each (first request ~1.4s, TLS warmup).
- Detail page: 8 concurrent fetches completed in ~3.1s, all 200, no throttling, no 429s.

The site did not rate-limit at concurrency 8, **but nothing here is worth being rude for.** The
prototype ships with deliberately gentle defaults and they should carry over:

- Sequential requests with a **1000ms delay** (`--delay`).
- Identifiable `User-Agent`.
- **On-disk HTML cache** (`.cache/`) so re-runs and parser iteration cost zero requests — this is
  the single biggest courtesy win, since parser development is where you'd otherwise refetch
  thousands of times.
- Retry with exponential backoff on 429/5xx.

Rough full-run size at 20/page: Oahu active = 3,626 → **182 list pages**, then 3,626 detail
fetches. Oahu "any" would hit the 498-page cap.

## 7. Prototype in this directory

`scrape.ts` — step 1 only, working. Reads `index.json`, writes `listings.json`.

```
bun scrape.ts                      # all islands, active only
bun scrape.ts --island oahu
bun scrape.ts --status any         # include sold/pending
bun scrape.ts --max-pages 5
bun scrape.ts --no-cache
bun scrape.ts --delay 2000
```

Verified runs: Lanai 5/5, Maui 73/73 across 4 pages, cached re-run instant.

**This is throwaway prototype code** — it's a single file with no tests, no structured logging,
and no error taxonomy. It exists to prove the approach and to document the URL format in
executable form. Rebuild it properly; reuse the findings, not the file.

## 8. Recommendations for the real implementation

1. **No Playwright.** Plain `fetch` + `HTMLRewriter`. Adding a browser would be ~100x the cost
   for zero benefit here.
2. **Filter by status at the URL level** rather than scraping all 20,626 and discarding. If the
   pipeline only cares about active inventory, `128` cuts Oahu's work by 5.7x and sidesteps the
   pagination cap entirely.
3. **Keep the HTML cache** (or an S3/blob equivalent) as a distinct layer. Fetch and parse should
   be separately re-runnable — you will iterate on the parser far more than on the fetcher.
4. **Persist raw HTML before parsing.** The `dt`/`dd` layout is stable but unversioned and could
   change without notice; keeping raw HTML means a parser fix doesn't require a refetch.
5. **Treat pagination as parallelizable** but rate-limit deliberately. Since deep pages are
   directly addressable, a bounded work queue over `(island, status, page)` is the natural shape.
6. **Pagination drift:** the dataset changes under you during a long run, so rows can shift
   between pages while paging. Dedupe by MLS number (the prototype does) and consider sorting by
   `d` (newest) for a more stable ordering than the default price sort.
7. **MLS number is the natural primary key** — 9 digits, appears both in the list href and as the
   `MLS #` detail field, so it's a reliable join between step 1 and step 3.

## 9. Open questions not yet investigated

- Whether other search types (`Address`, `Condominium`, `MLSNUM`, `HotSheet`) expose slicing that
  beats the 9,960 cap — `HotSheet` in particular looked like a recent-changes feed, which would
  suit incremental refresh better than re-walking every page.
- What segment 5 (`7`) and the region code actually enumerate — the non-Oahu seed URLs return
  suspiciously small/round counts (Kauai 33, Maui 73, Hawaii 200, Molokai 20, Lanai 5) and may
  not be selecting whole islands. **Worth confirming those seed URLs are what you think they are
  before trusting the non-Oahu numbers.**
