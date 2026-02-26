-- Add scraped_at to current-state snapshot tables
-- Backfill existing records with '2025-10-01' (matching scrape_status seed date)

-- owners
ALTER TABLE owners ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE owners SET scraped_at = '2025-10-01';
ALTER TABLE owners MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- land_classifications
ALTER TABLE land_classifications ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE land_classifications SET scraped_at = '2025-10-01';
ALTER TABLE land_classifications MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- residential_improvements
ALTER TABLE residential_improvements ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE residential_improvements SET scraped_at = '2025-10-01';
ALTER TABLE residential_improvements MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- residential_additions
ALTER TABLE residential_additions ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE residential_additions SET scraped_at = '2025-10-01';
ALTER TABLE residential_additions MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- commercial_improvements
ALTER TABLE commercial_improvements ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE commercial_improvements SET scraped_at = '2025-10-01';
ALTER TABLE commercial_improvements MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- commercial_improvement_details
ALTER TABLE commercial_improvement_details ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE commercial_improvement_details SET scraped_at = '2025-10-01';
ALTER TABLE commercial_improvement_details MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- yard_improvements
ALTER TABLE yard_improvements ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE yard_improvements SET scraped_at = '2025-10-01';
ALTER TABLE yard_improvements MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- agricultural_assessments
ALTER TABLE agricultural_assessments ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE agricultural_assessments SET scraped_at = '2025-10-01';
ALTER TABLE agricultural_assessments MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- accessory_structures
ALTER TABLE accessory_structures ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE accessory_structures SET scraped_at = '2025-10-01';
ALTER TABLE accessory_structures MODIFY COLUMN scraped_at DATETIME NOT NULL;

-- current_tax_bills
ALTER TABLE current_tax_bills ADD COLUMN scraped_at DATETIME AFTER tmk;
UPDATE current_tax_bills SET scraped_at = '2025-10-01';
ALTER TABLE current_tax_bills MODIFY COLUMN scraped_at DATETIME NOT NULL;
