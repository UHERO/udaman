-- Dead-column audit fixes (see parse-audit).
--
-- 1. commercial_improvement_details.occupancy: dropped. No county ever
--    supplies a distinct occupancy value — Kauai renders the column but leaves
--    it blank on every sampled row (538 rows across 2025-2 and 2026-1), and
--    Maui/Big Island's "Occupancy" header is their label for the usage column,
--    whose values already land in `usage`. (residential_improvements.occupancy
--    is unrelated, Honolulu-populated, and stays.)
--
-- 2. properties/parcels.non_taxable_status: widened. The column is Kauai-only
--    (the old schema comment saying Big Island was wrong) and holds prose up
--    to ~118 chars ("Non-taxable road, remnant or right-of way information.
--    This is a non-taxable road or right-of-way."), which VARCHAR(50) would
--    truncate. The column was always NULL until the isTaxPaymentField parser
--    fix, so widening needs no backfill.
ALTER TABLE commercial_improvement_details DROP COLUMN occupancy;

ALTER TABLE properties MODIFY COLUMN non_taxable_status VARCHAR(255) COMMENT 'Non-taxable status prose (Kauai only), e.g. "Government owned parcel. ..."';

ALTER TABLE parcels MODIFY COLUMN non_taxable_status VARCHAR(255);
