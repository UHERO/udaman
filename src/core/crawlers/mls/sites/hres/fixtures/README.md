# hres fixtures

Real pages from hawaiirealestatesearch.com, fetched 2026-09-19 (one request
every 5 s, per robots.txt), then shrunk mechanically. The raw pages are
~250 KB (detail) / ~480 KB (list); about 70 % of that is inline script, CSS
and SVG icons the parsers never look at.

## How they were stripped

A throwaway Bun script (not in the repo) applied exactly these four
replacements, in this order, and nothing else:

```ts
html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
  .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, "")
  .replace(/<!--[\s\S]*?-->/g, "");
```

No whitespace collapsing, no attribute or element pruning. Deliberately kept:
the `data-listing` JSON, every `og:image` meta, the gallery / slideshow photo
URLs, all `p.disclaimer` blocks, the County Tax link, and the "Similar
Properties" cards — so the scoping tests (cards and later disclaimers must
never leak into a result) run against the real markup.

Before writing each fixture the script asserted that `parseDetail` /
`parseList` returns a deep-equal result for the raw and the stripped page; the
same check passed for all 61 detail + 8 list pages of the survey corpus.

## Files

| Fixture                                   | Board | Why it is here                                                                                                                                                                                                                           |
| ----------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detail-hbr-condo-202617839.html`         | HBR   | Oahu condo. Full/Half Baths next to `Bathrooms`, `Acres` 0.00, `Has Pool` only, `Exterior` = construction, long `Parking` rendered as its own section, TMK with a CPR number (HiCentral shows the same listing as `1-9-4-007-046-0028`). |
| `detail-hbr-no-tax-link-202613482.html`   | HBR   | Single family with NO County Tax link (so no TMK). `Interior` / `Exterior` / `Features` quirks next to `Construction` / `Lot Description`, schools, `County`.                                                                            |
| `detail-his-single-family-733542.html`    | HIS   | Big Island. `Assesed Value` [sic], district as `City`. Third similar card is an HBR listing and a later disclaimer names HBR.                                                                                                            |
| `detail-his-vacant-land-730446.html`      | HIS   | No Sub-Type, no beds/baths; empty "Listing Details" section with `Office` rendered as its own section.                                                                                                                                   |
| `detail-his-commercial-720819.html`       | HIS   | Kauai commercial, Active Under Contract, `Building Name` as its own section, no similar cards.                                                                                                                                           |
| `detail-his-no-photo-733417.html`         | HIS   | No photo (`og:image` = `/img/no-image.jpg`), no tax link, no `Land Tenure`: board from the disclaimer, island from geo.                                                                                                                  |
| `detail-ram-condo-410851.html`            | RAM   | `Bathrooms` only (no Full/Half), `Waterfront: None`, project-wide `Acres` on a condo.                                                                                                                                                    |
| `detail-ram-leasehold-410844.html`        | RAM   | Leasehold with `Monthly Lease Fee` + `Monthly Lease Fees` + `Lease Expires`; `Office Contact` phone that must be dropped; an HBR similar card and a later HBR disclaimer.                                                                |
| `detail-ram-wrong-county-app-410825.html` | RAM   | Kula, Maui listing whose tax link uses Hawaii County's AppID (1048) — the agent typed a Big Island ZIP. Disclaimers run RAM, HIS, RAM; the one similar card is HIS.                                                                      |
| `detail-not-found-399999.html`            | —     | The HTTP 404 "Listing Not Found" page → `parseDetail` returns `null`.                                                                                                                                                                    |
| `list-maui-p1.html`                       | RAM   | "1,875 Properties Found. Page 1 of 40." — 48 cards, includes a Molokai listing.                                                                                                                                                          |
| `list-kauai-p10.html`                     | HIS   | "599 Properties Found. Page 10 of 13." — 48 cards.                                                                                                                                                                                       |

The corpus had no Molokai / Lanai detail page, no photo-less list card and no
past-the-end list page; those cases are covered by synthetic pages built in
the tests.
