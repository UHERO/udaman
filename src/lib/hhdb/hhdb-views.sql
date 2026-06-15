-- ============================================================================
-- VIEWS FOR CONVENIENCE
-- Run manually on remote: mariadb hawaii_housing_database < hhdb-views.sql
-- ============================================================================

-- View: Properties with current assessment
CREATE
OR REPLACE VIEW v_properties_current AS
SELECT
    p.*,
    a.tax_year,
    a.property_class AS current_property_class,
    a.total_net_taxable_value,
    a.total_property_assessed_value,
    a.assessed_land_value,
    a.assessed_building_value
FROM
    properties p
    LEFT JOIN assessments a ON p.tmk = a.tmk
WHERE
    a.tax_year = (
        SELECT
            MAX(tax_year)
        FROM
            assessments
        WHERE
            tmk = p.tmk
    );

-- View: Condo projects with unit counts
CREATE
OR REPLACE VIEW v_condo_projects AS
SELECT
    cp.tmk,
    cp.project_name,
    cp.unit_count,
    p.location_address,
    p.island_code,
    COUNT(cu.id) AS actual_unit_count
FROM
    condominium_projects cp
    JOIN properties p ON cp.tmk = p.tmk
    LEFT JOIN condominium_units cu ON cp.tmk = cu.parent_tmk
GROUP BY
    cp.tmk,
    cp.project_name,
    cp.unit_count,
    p.location_address,
    p.island_code;
