-- The DCCA condo register (web3.dcca.hawaii.gov/reb/public) prints land
-- ownership as a phrase ("FEE SIMPLE", "LEASEHOLD", …) where the old DPR.Net
-- site used codes (FO, L, FC, …). `bun run dcca load` stores the phrase; at
-- VARCHAR(10) a longer phrase would fail the UPDATE under strict mode.
--
-- condominium_projects is a qpub pipeline table (recreated from
-- hhdb-schema.sql on every sync), so the same change is in hhdb-schema.sql;
-- this file is for the remote copy that already exists.
--
-- Applied by hand:
--   mariadb -h <host> -u <user> -p hawaii_housing_database < 2026-09-22-widen-condo-land-ownership.sql
ALTER TABLE condominium_projects
  MODIFY land_ownership VARCHAR(50)
  COMMENT 'Land ownership as the DCCA register prints it (FEE SIMPLE, LEASEHOLD, …); legacy DPR.Net codes (FC, FO, L, PC, …) on rows the current register does not match';
