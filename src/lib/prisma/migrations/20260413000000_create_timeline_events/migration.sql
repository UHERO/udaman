-- CreateTable 
DROP TABLE timeline_events;
CREATE TABLE `timeline_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `event_type` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_timeline_events_event_type` (`event_type`),
  INDEX `idx_timeline_events_dates` (`start_date`, `end_date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed: other event types
INSERT INTO
  `timeline_events` (
    `event_type`,
    `name`,
    `start_date`,
    `end_date`
  )
VALUES
  (
    'recession',
    'Recession (1960-61)',
    '1960-04-01',
    '1961-02-01'
  ),
  (
    'recession',
    'Recession (1969-70)',
    '1969-12-01',
    '1970-11-01'
  ),
  (
    'recession',
    'Recession (1973-75)',
    '1973-11-01',
    '1975-03-01'
  ),
  (
    'recession',
    'Recession (1980)',
    '1980-01-01',
    '1980-07-01'
  ),
  (
    'recession',
    'Recession (1981-82)',
    '1981-07-01',
    '1982-11-01'
  ),
  (
    'recession',
    'Recession (1990-91)',
    '1990-07-01',
    '1991-03-01'
  ),
  (
    'recession',
    'Recession (2001)',
    '2001-03-01',
    '2001-11-01'
  ),
  (
    'recession',
    'Great Recession (2007-09)',
    '2007-12-01',
    '2009-06-01'
  ),
  (
    'recession',
    'COVID-19 Recession (2020)',
    '2020-02-01',
    '2020-04-01'
  ),
  (
    'military_action',
    'Gulf War',
    '1990-08-02',
    '1991-02-28'
  ),
  (
    'military_action',
    'Iraq War',
    '2003-03-20',
    NULL
  ),
  (
    'military_action',
    'Russia-Ukraine War',
    '2022-02-24',
    NULL
  ),
  (
    'military_action',
    'US-Iran-Israel Operations',
    '2024-04-13',
    NULL
  ),
  (
    'economic_crisis',
    'OPEC Oil Embargo',
    '1973-10-17',
    '1974-03-18'
  ),
  (
    'economic_crisis',
    '1979 Oil Crisis',
    '1979-01-01',
    '1979-06-01'
  ),
  (
    'economic_crisis',
    'Black Monday',
    '1987-10-19',
    NULL
  ),
  (
    'economic_crisis',
    'Asian Financial Crisis',
    '1997-07-02',
    '1998-12-31'
  ),
  (
    'economic_crisis',
    'Weak Japanese Yen vs USD',
    '2022-01-01',
    '2026-12-01'
  ),
  (
    'economic_crisis',
    '9/11 Attacks',
    '2001-09-11',
    NULL
  ),
  (
    'economic_crisis',
    'Dot-com Crash',
    '2000-03-10',
    '2002-10-09'
  ),
  (
    'economic_crisis',
    'US-China Trade War',
    '2018-07-06',
    NULL
  ),
  (
    'economic_crisis',
    'Suez Canal Blockage',
    '2021-03-23',
    '2021-03-29'
  ),
  (
    'economic_crisis',
    'Post-COVID Revenge Travel Surge',
    '2022-04-01',
    '2023-06-01'
  ),
  (
    'pandemic',
    'SARS Outbreak',
    '2003-02-01',
    '2003-07-01'
  ),
  (
    'pandemic',
    'H1N1 Pandemic',
    '2009-04-15',
    '2010-08-10'
  ),
  (
    'pandemic',
    'COVID-19 Pandemic',
    '2020-01-30',
    '2023-05-11'
  ),
  (
    'natural_disaster',
    'Hurricane Iniki',
    '1992-09-11',
    NULL
  ),
  (
    'natural_disaster',
    'Hurricane Katrina',
    '2005-08-29',
    NULL
  ),
  (
    'natural_disaster',
    'Tohoku Earthquake & Tsunami (Japan)',
    '2011-03-11',
    NULL
  ),
  (
    'natural_disaster',
    'Lahaina Wildfire',
    '2023-08-08',
    NULL
  ),
  (
    'natural_disaster',
    'Kilauea Eruption (Big Island)',
    '2018-05-01',
    '2018-08-01'
  ),
  (
    'natural_disaster',
    'Hawaii Flooding & Storm Events',
    '2026-03-01',
    NULL
  ),
  (
    'natural_disaster',
    'Indian Ocean Tsunami',
    '2004-12-26',
    '2005-06-01'
  ),
  (
    'natural_disaster',
    'Kiholo Bay Earthquake (Hawaii)',
    '2006-10-15',
    NULL
  ),
  (
    'public_public_policy',
    'Nixon Shock',
    '1971-08-15',
    NULL
  ),
  (
    'public_public_policy',
    'G5 Plaza Accord',
    '1985-09-22',
    NULL
  ),
  (
    'public_public_policy',
    'NAFTA',
    '1994-01-01',
    NULL
  ),
  (
    'public_public_policy',
    'China WTO Accession',
    '2001-12-11',
    NULL
  ),
  (
    'public_public_policy',
    'Brexit',
    '2020-01-31',
    NULL
  ),
  (
    'public_public_policy',
    'USMCA',
    '2020-07-01',
    NULL
  ),
  (
    'public_public_policy',
    'CPTPP',
    '2018-12-30',
    NULL
  ),
  (
    'economic_crisis',
    'Japanese Asset Bubble Collapse',
    '1990-01-01',
    '1995-12-01'
  ),
  (
    'economic_crisis',
    'Asian Financial Crisis',
    '1997-07-01',
    '1998-12-01'
  ),
  (
    'economic_crisis',
    'Flash Crash',
    '2010-05-06',
    '2010-05-10'
  ),
  (
    'aviation_incident',
    'Malaysia Airlines Flight 370 Disappearance',
    '2014-03-08',
    '2014-06-01'
  ),
  (
    'aviation_incident',
    'Malaysia Airlines Flight 17 Shootdown',
    '2014-07-17',
    '2014-10-01'
  ),
  (
    'aviation_crisis',
    'Boeing 737 MAX Groundings',
    '2019-03-01',
    '2020-11-01'
  ),
  (
    'public_policy',
    'US Government Shutdown',
    '2013-10-01',
    '2013-10-17'
  ),
  (
    'public_policy',
    'US Government Shutdown (Longest)',
    '2018-12-22',
    '2019-01-25'
  );

-- No dedicated role_permissions needed — timeline_event is covered by the
-- wildcard (resource=*, action=*) rows that each role already has.