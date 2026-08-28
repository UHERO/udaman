-- Add structured mailing-address columns to owners.
--
-- Honolulu's qPublic template renders no owner/mailing address at all (see
-- county-gaps.md), so owners.owner_address is NULL for every county-1 row.
-- The city's own OWNERDAT tax-bill extract gives us a mailing address per
-- parcel instead, but it's a single tax-bill address per parcel while
-- owners can have several co-owner rows per tmk with genuinely different
-- addresses (see counties 2-4) — so it's kept as its own structured column
-- set rather than folded blindly into owner_address for every co-owner row.
-- The backfill script (hhdb-backfill-hnl-owner-mailing.ts) matches the tax
-- bill's owner name against the specific owner row it belongs to and also
-- synthesizes a one-line value into owner_address for that row, so existing
-- owner_address consumers see something for Honolulu without changes.
ALTER TABLE owners
    ADD COLUMN mailing_address TEXT COMMENT 'Structured mailing street address (e.g. county tax-bill extract), independent of owner_address' AFTER owner_address,
    ADD COLUMN mailing_city VARCHAR(100) COMMENT 'Mailing city' AFTER mailing_address,
    ADD COLUMN mailing_state VARCHAR(50) COMMENT 'Mailing state/province' AFTER mailing_city,
    ADD COLUMN mailing_zip VARCHAR(10) COMMENT 'Mailing ZIP, or ZIP+4 as NNNNN-NNNN when available' AFTER mailing_state,
    ADD COLUMN mailing_country VARCHAR(100) COMMENT 'Mailing country, populated only when outside the US' AFTER mailing_zip;
