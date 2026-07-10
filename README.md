# UDAMAN 2.0

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Getting The DB Ready

App is intended to replace udaman as-is, but there have been a few minor db changes. When ready to deploy, check for prisma install then run the following on the server.

```bash
  # 1. Generate the baseline from current DB state and mark as applied
  #    (tells Prisma "these tables already exist, don't try to create them")
  bunx prisma migrate resolve --applied 0_init

  # 2. Apply all remaining migrations (universe table, join table PKs, auth tables)
  bunx prisma migrate deploy
```

## Hawaii Housing Database (QPub)

Separate MariaDB database (`hawaii_housing_database`) that stores statewide property data scraped from Hawaii's county QPub tax assessment websites. Covers ~600k properties across 4 islands (Oahu, Maui, Hawaii, Kauai).

### Pipeline

Three-stage pipeline: **scrape → parse → load**.

```
QPub Website → [scrape] → HTML on NAS → [parse] → JSON on NAS → [load] → MariaDB
```

**Scrape**: Playwright Chromium instance fetches each property's QPub profile page and saves the raw HTML to the NAS. Runs during the day (5am-10pm HST), handles captcha/blocked detection, and tracks progress in the `scrape_status` table. Properties are re-scraped every 6 months.

**Parse**: Reads saved HTML, extracts structured data into JSON using section-specific parsers, and writes the JSON to NAS. Detects page type (residential, condo project, etc.).

**Load**: Reads parsed JSON and loads into ~20 database tables. Uses change-detection logic -- records are never deleted during load. Instead, unchanged data gets its `last_year_observed` bumped, changed data gets a new row inserted, and records no longer present on the page are detectable by their stale `last_year_observed`.

### NAS file layout

```
/UHEROroot/work/scrapes/qpub/
  html/{period}/{island}/{zone}/{section}/{tmk}.html
  json/{period}/{island}/{zone}/{section}/{tmk}.json
```

- `period`: scrape cycle, e.g. `2026-1` (Mar-Jul) or `2026-2` (Sep-Dec)
- `island`: `1` (Oahu), `2` (Maui), `3` (Hawaii), `4` (Kauai)
- `zone`, `section`: derived from TMK digits

### Daily operation

The scraper process (`bun run scraper`) runs continuously on the scraper-worker machine. During the day it scrapes, and at the 10pm cutoff (or when all records are current) it automatically runs nightly parse+load on freshly scraped records before sleeping until 5am.

### Manual commands

Run on the scraper-worker machine:

```sh
# Parse+load freshly scraped records (same as nightly auto-run)
bun run qpub nightly

# Rebuild a single table from all HTML files on NAS
bun run qpub rebuild-table owners
bun run qpub rebuild-table parcels --island 1    # Oahu only
bun run qpub rebuild-table assessments --period 2026-1

# Rebuild all tables from all HTML files (full database repopulation)
bun run qpub rebuild-all
bun run qpub rebuild-all --island 2              # Maui only
```

Valid table names: `properties`, `parcels`, `owners`, `assessments`, `land_classifications`, `residential_improvements`, `commercial_improvements`, `sales`, `permits`, `historical_tax`, `current_tax_bills`, `condominium`, `yard_improvements`, `residential_additions`, `agricultural_assessments`, `accessory_structures`, `appeals`, `dedications`

### Full database rebuild

For a complete rebuild (e.g. after schema changes):

1. Drop and recreate the target table(s) using `src/lib/hhdb/hhdb-schema.sql`
2. Run the appropriate rebuild command above

### Change detection columns

- **`last_year_observed`**: On snapshot tables (parcels, owners, improvements, etc.). The most recent tax year in which we observed this record. Updated when re-scraped data is unchanged.
- **`tax_year`**: Only on tables where it's inherent to the data itself: `assessments`, `dedications`.
- **`scraped_at`**: When the HTML was fetched. Updated on every observation.

### Processes

| Process | Command           | Machine        | Purpose                                    |
| ------- | ----------------- | -------------- | ------------------------------------------ |
| App     | `bun run start`   | prod           | Next.js app + admin panel                  |
| Worker  | `bun run worker`  | worker         | BullMQ jobs (time series reloads, exports) |
| Scraper | `bun run scraper` | scraper-worker | QPub scraping + nightly parse/load         |

# ToDo Notes For Later

1. Implement a standard, response shape from controllers. Something like:
   ```js
   return { message: "Succesfully did action", data: payload };
   ```
   Doesn't need to be fancy, but controller seems like the appropriate layer to handle basic logging & messages. Messages can be used in Toasts in the UI to show confirmations/errors to the user.
2. Set consistent log levels, maybe info for controllers, debug for models & collections.

3. Setup testing for the write methods, anything using CREATE, INSERT, DELETE, UPDATE. Much of this code has been ai generated, and before putting the app on prod it's important that these actions are reviewed carefully.
   - Note that Deletes need to be reviewed so that they aren't leaving orphaned records.
   - Updates, Insert, Creates need to be reviewed to ensure related records are also updated or created where relevant.
   - Claude's gotten pretty great, but it still often misses the broader context when methods are interconnected.

4. Better Series Lists.
   - A Offer a few preset lists the user can choose, 'most recently created', 'most recently updated' (jobs data after a job update), series with problems, or specific data lists. OR
   - Let user's pick measurements to show.
   - Maybe do #1 first and do #2 after scraping completed.

# Migrations needed

1. dataPortalName is appears to be the only camelCase name in a database of snake_case names. setup a migration to rename to data_portal_name.
2. yoy,ytd,change fields in the database are unused. Remove them. These are calculated each time, probably better that way.
