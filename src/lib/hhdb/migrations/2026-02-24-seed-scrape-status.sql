-- Seed scrape_status with one row per property.
-- Sets scrape/parse/load to 'pending' (defaults) with scraped_at and parsed_at
-- backdated to October 2025 when the first wave of data was gathered.
INSERT INTO scrape_status (tmk, scrape_status, scraped_at, parse_status, parsed_at)
SELECT tmk, 'success', '2025-10-01 00:00:00', 'success', '2025-10-01 00:00:00'
FROM properties;
