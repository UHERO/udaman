-- Widen unique_tax_bill to include description.
--
-- 2026-08-13-current-tax-bills-key.sql keyed current_tax_bills on
-- (tmk, tax_period) alone, on the assumption that the table is one bill per
-- period per parcel. It isn't: a parcel can carry several concurrent line
-- items for the same period — the base "Property Tax"/"Real Property Tax"
-- bill plus special assessment district fees ("WAIKIKI SPECIAL IMPROVEMENT
-- DI", "Waikiki ID 25/100/33.30", "Kailua Village BID", "KUKUIULA CFD", etc.),
-- all due on the same date and differing only by description.
--
-- That migration's dedupe step (keep only the newest row per tmk+tax_period)
-- silently discarded whichever of those bills didn't happen to be the most
-- recently scraped, and the new key then made the discard permanent by
-- rejecting the second bill on every subsequent load — which is what crashed
-- a full rebuild-all the first time it hit a parcel with a real second bill
-- in the same INSERT batch: ERROR 1062 Duplicate entry '...-2025-2' for key
-- 'unique_tax_bill'.
--
-- No dedupe is needed here: (tmk, tax_period) was already unique, so
-- (tmk, tax_period, description) is trivially unique too — nothing to drop
-- before widening it. The dropped bills themselves aren't recoverable from
-- this table (the losing rows are gone), but they'll reappear on the next
-- full rebuild-all, which re-extracts every bill line from the scraped
-- source data rather than from this table.
ALTER TABLE current_tax_bills
    DROP KEY unique_tax_bill,
    ADD UNIQUE KEY unique_tax_bill (tmk, tax_period, description);
