-- Drop accessory_structures. The table never received a row: its section key
-- ("accessory_structure_information") is not a heading any county renders, so
-- the loader never matched it. Maui's "Accessory Information" section — the
-- same class of structures (sheds, garages, carports, pools) — is routed to
-- yard_improvements instead (GENERIC_SECTION_MAP in qpub-load.ts), which is
-- also where Oahu/Hawaii's "Other Building and Yard Improvements" lands.
--
-- The table has been removed from hhdb-schema.sql, so rebuilds no longer
-- recreate it; this migration removes it from databases built before that.
DROP TABLE IF EXISTS accessory_structures;
