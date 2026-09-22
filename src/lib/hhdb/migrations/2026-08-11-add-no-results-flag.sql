-- Retire TMKs that qPublic has no record of.
--
-- These scrape cleanly — 200 OK, no captcha, a normal-looking report page that
-- keeps the "qPublic ... Report:" title — but carry no parcel at all. The tell
-- is the footer notice listing modules with no data: on a real profile it holds
-- only optional sections, on a phantom parcel it leads with "Parcel
-- Information". Size is no help; Hawaii serves them at 170-190 KB.
--
-- Left in place rather than deleted, for the same reason absent parcels are:
-- the row is the record that we asked and the county had nothing. The flag
-- takes them out of the scrape, parse and load queues without losing that.
--
-- Set by the scraper on discovery, and by `qpub repair` for files already on
-- the NAS. Cleared only by hand, if a parcel later starts resolving.

ALTER TABLE scrape_status
    ADD COLUMN no_results TINYINT(1) NULL DEFAULT NULL
        COMMENT '1 = qPublic has no record for this TMK; excluded from all queues',
    ADD COLUMN no_results_at DATETIME NULL
        COMMENT 'When the empty page was last observed',
    ADD INDEX idx_no_results (no_results);
