-- Convert all tables from utf8mb3_general_ci to utf8mb4_unicode_ci
-- Required for FK compatibility with new tables (e.g. scrape_status)
--
-- MariaDB 10.11 won't allow CONVERT TO on columns used in FK constraints,
-- so we must: drop all FKs → convert all tables → re-add all FKs.

-- ============================================================================
-- 1. DROP ALL FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- commercial_improvement_details has 2 FKs
ALTER TABLE commercial_improvement_details DROP FOREIGN KEY commercial_improvement_details_ibfk_1;
ALTER TABLE commercial_improvement_details DROP FOREIGN KEY commercial_improvement_details_ibfk_2;

-- condominium_units has 2 FKs
ALTER TABLE condominium_units DROP FOREIGN KEY condominium_units_ibfk_1;
ALTER TABLE condominium_units DROP FOREIGN KEY condominium_units_ibfk_2;

-- historical_tax_credits has 2 FKs
ALTER TABLE historical_tax_credits DROP FOREIGN KEY historical_tax_credits_ibfk_1;
ALTER TABLE historical_tax_credits DROP FOREIGN KEY historical_tax_credits_ibfk_2;

-- historical_tax_details has 2 FKs
ALTER TABLE historical_tax_details DROP FOREIGN KEY historical_tax_details_ibfk_1;
ALTER TABLE historical_tax_details DROP FOREIGN KEY historical_tax_details_ibfk_2;

-- historical_tax_payments has 2 FKs
ALTER TABLE historical_tax_payments DROP FOREIGN KEY historical_tax_payments_ibfk_1;
ALTER TABLE historical_tax_payments DROP FOREIGN KEY historical_tax_payments_ibfk_2;

-- Single FK tables
ALTER TABLE accessory_structures     DROP FOREIGN KEY accessory_structures_ibfk_1;
ALTER TABLE agricultural_assessments DROP FOREIGN KEY agricultural_assessments_ibfk_1;
ALTER TABLE appeals                  DROP FOREIGN KEY appeals_ibfk_1;
ALTER TABLE assessments              DROP FOREIGN KEY assessments_ibfk_1;
ALTER TABLE commercial_improvements  DROP FOREIGN KEY commercial_improvements_ibfk_1;
ALTER TABLE condominium_projects     DROP FOREIGN KEY condominium_projects_ibfk_1;
ALTER TABLE current_tax_bills        DROP FOREIGN KEY current_tax_bills_ibfk_1;
ALTER TABLE dedications              DROP FOREIGN KEY dedications_ibfk_1;
ALTER TABLE historical_tax_summary   DROP FOREIGN KEY historical_tax_summary_ibfk_1;
ALTER TABLE land_classifications     DROP FOREIGN KEY land_classifications_ibfk_1;
ALTER TABLE owners                   DROP FOREIGN KEY owners_ibfk_1;
ALTER TABLE permits                  DROP FOREIGN KEY permits_ibfk_1;
ALTER TABLE residential_additions    DROP FOREIGN KEY residential_additions_ibfk_1;
ALTER TABLE residential_improvements DROP FOREIGN KEY residential_improvements_ibfk_1;
ALTER TABLE sales                    DROP FOREIGN KEY sales_ibfk_1;
ALTER TABLE yard_improvements        DROP FOREIGN KEY yard_improvements_ibfk_1;

-- ============================================================================
-- 2. CONVERT DATABASE DEFAULT + ALL TABLES
-- ============================================================================

ALTER DATABASE hawaii_housing_database
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- Parent tables first, then children (order doesn't matter without FKs, but reads clearly)
ALTER TABLE properties              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE accessory_structures    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE agricultural_assessments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE appeals                 CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE assessments             CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE commercial_improvements CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE commercial_improvement_details CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE condominium_projects    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE condominium_units       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE current_tax_bills       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE dedications             CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE historical_tax_credits  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE historical_tax_details  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE historical_tax_payments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE historical_tax_summary  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE land_classifications    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE owners                  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE parcels                 CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE permits                 CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE residential_additions   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE residential_improvements CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE sales                   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE yard_improvements       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- tg_transactions already utf8mb4_unicode_ci — skip

-- ============================================================================
-- 3. RE-ADD ALL FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Single FK tables (tmk → properties.tmk)
ALTER TABLE accessory_structures     ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE agricultural_assessments ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE appeals                  ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE assessments              ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE commercial_improvements  ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE condominium_projects     ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE current_tax_bills        ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE dedications              ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE historical_tax_summary   ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE land_classifications     ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE owners                   ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE permits                  ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE residential_additions    ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE residential_improvements ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE sales                    ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
ALTER TABLE yard_improvements        ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;

-- Multi-FK tables
ALTER TABLE commercial_improvement_details
  ADD FOREIGN KEY (commercial_improvement_id) REFERENCES commercial_improvements(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;

ALTER TABLE condominium_units
  ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE,
  ADD FOREIGN KEY (parent_tmk) REFERENCES condominium_projects(tmk) ON DELETE CASCADE;

ALTER TABLE historical_tax_credits
  ADD FOREIGN KEY (historical_tax_summary_id) REFERENCES historical_tax_summary(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;

ALTER TABLE historical_tax_details
  ADD FOREIGN KEY (historical_tax_summary_id) REFERENCES historical_tax_summary(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;

ALTER TABLE historical_tax_payments
  ADD FOREIGN KEY (historical_tax_summary_id) REFERENCES historical_tax_summary(id) ON DELETE CASCADE,
  ADD FOREIGN KEY (tmk) REFERENCES properties(tmk) ON DELETE CASCADE;
