-- Key current_tax_bills by (tmk, tax_period), and drop the rollup rows that
-- made that impossible.
--
-- qPublic renders a trailing summary line under the real per-period rows:
-- blank Tax Period, description "Tax Bill with Interest computed through
-- <date>", amounts equal to the column totals. It is not a bill, and it was
-- 44.5% of this table — 452,518 of 1,016,290 rows.
--
-- It was also self-multiplying. Its description embeds a date that advances
-- with every scrape, so the loader's change detection could never match it and
-- stored a fresh version on every load. Left in place, the pending reload of
-- ~576k parcels would have added roughly another 450,000 of them.
--
-- With those gone, the table is one bill per period per parcel. The remaining
-- duplicates (1.051 per key) are interest/penalty accrual restating the same
-- bill — current state, not history — so the surviving row is the most recently
-- scraped one.
--
-- Run order matters: delete, then dedupe, then add the key. The ALTER fails if
-- either preceding step is skipped, which is the intended safety net.

-- 1. Drop the rollup rows.
DELETE FROM current_tax_bills
WHERE tax_period IS NULL OR TRIM(tax_period) = '';

-- 2. Keep only the newest row per (tmk, tax_period).
--    Ties on scraped_at fall back to the highest id, matching the
--    "ORDER BY last_year_observed DESC, id DESC" rule the loader used.
DELETE c FROM current_tax_bills c
JOIN (
    SELECT tmk, tax_period, MAX(id) AS keep_id
    FROM current_tax_bills
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY tmk, tax_period
                       ORDER BY last_year_observed DESC, scraped_at DESC, id DESC
                   ) AS rn
            FROM current_tax_bills
        ) ranked WHERE rn = 1
    )
    GROUP BY tmk, tax_period
) k ON k.tmk = c.tmk AND k.tax_period = c.tax_period
WHERE c.id <> k.keep_id;

-- 3. Enforce it from here on.
ALTER TABLE current_tax_bills
    ADD UNIQUE KEY unique_tax_bill (tmk, tax_period);


-- ── dedications ──────────────────────────────────────────────────────────
-- This table is empty and always has been: GENERIC_SECTION_MAP looked for a
-- section called "dedication_information" while the parser emits
-- "dedications", so loadGenericSections skipped it silently on every load.
-- With that fixed, one row per parcel per tax year is the natural grain, and
-- an empty table makes the key free to add now rather than after a backfill.
ALTER TABLE dedications
    ADD UNIQUE KEY unique_dedication (tmk, tax_year);


-- ── yard_improvements absorbs Maui's Accessory Information ──────────────
-- Maui records the same structures (sheds, decks, garage doors) under a
-- heading of "Accessory Information", with size packed into one cell reading
-- "<dimensions> <area> / <quantity>" - e.g. "0x0 320 / 1". Split out, the row
-- is the shape the other counties already produce, so both now load here.
--
-- Both tables are empty today (accessory_structures for the same section-key
-- bug), so these columns can be added without a backfill. accessory_structures
-- is left in place but is no longer written to.
ALTER TABLE yard_improvements
    ADD COLUMN building_number VARCHAR(20) NULL COMMENT 'Maui only' AFTER last_year_observed,
    ADD COLUMN dimensions VARCHAR(30) NULL COMMENT 'Maui, from the "Dimensions/Units" cell, e.g. "0x0"' AFTER description,
    ADD COLUMN percent_complete VARCHAR(10) NULL COMMENT 'Maui only' AFTER area,
    ADD COLUMN value BIGINT UNSIGNED NULL COMMENT 'Assessed value; Oahu/Hawaii call it Gross Building Value' AFTER percent_complete;


-- ── area and percent_complete become numbers ────────────────────────────
-- Both are scraped as formatted strings ("297,000" sq ft on Oahu, "100%") and
-- were stored verbatim. That left area holding two shapes at once once Maui's
-- split started writing plain integers into the same column — and area is part
-- of the yard_improvements identity, where a formatting difference reads as a
-- different structure.
--
-- Surveyed across 700 pages: area is 0-11,091,000 with no non-numeric values
-- (INT UNSIGNED covers it); percent_complete only ever appears as "", "100%"
-- or "0%".
--
-- The strings are normalised BEFORE the type change. A bare MODIFY would stop
-- converting at the first comma and silently turn "1,486" into 1.
UPDATE residential_additions          SET area = REPLACE(area, ',', '') WHERE area LIKE '%,%';
UPDATE commercial_improvement_details SET area = REPLACE(area, ',', '') WHERE area LIKE '%,%';
UPDATE yard_improvements              SET area = REPLACE(area, ',', '') WHERE area LIKE '%,%';

UPDATE residential_improvements SET percent_complete = TRIM(TRAILING '%' FROM percent_complete);
UPDATE commercial_improvements  SET percent_complete = TRIM(TRAILING '%' FROM percent_complete);
UPDATE yard_improvements        SET percent_complete = TRIM(TRAILING '%' FROM percent_complete);

-- Empty strings would convert to 0, which is a real percentage; keep them NULL.
UPDATE residential_improvements SET percent_complete = NULL WHERE percent_complete = '';
UPDATE commercial_improvements  SET percent_complete = NULL WHERE percent_complete = '';
UPDATE yard_improvements         SET percent_complete = NULL WHERE percent_complete = '';

ALTER TABLE residential_additions          MODIFY area INT UNSIGNED COMMENT 'Square feet';
ALTER TABLE commercial_improvement_details MODIFY area INT UNSIGNED COMMENT 'Square feet';
ALTER TABLE yard_improvements              MODIFY area INT UNSIGNED COMMENT 'Square feet';

ALTER TABLE residential_improvements MODIFY percent_complete TINYINT UNSIGNED COMMENT 'Whole percent, 0-100';
ALTER TABLE commercial_improvements  MODIFY percent_complete TINYINT UNSIGNED COMMENT 'Whole percent, 0-100';
ALTER TABLE yard_improvements        MODIFY percent_complete TINYINT UNSIGNED COMMENT 'Whole percent, 0-100';
