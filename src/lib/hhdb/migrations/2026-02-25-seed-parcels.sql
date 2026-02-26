-- Seed parcels from existing properties data
INSERT INTO parcels (tmk, scraped_at, parcel_number, location_address, address_other,
    project_name, legal_information, property_class, land_area_sqft, land_area_acres,
    neighborhood_code, zoning, parcel_note, damage, reentry_zone, zone_color,
    non_taxable_status, living_units)
SELECT tmk, '2025-10-01', parcel_number, location_address, address_other,
    project_name, legal_information, property_class, land_area_sqft, land_area_acres,
    neighborhood_code, zoning, parcel_note, damage, reentry_zone, zone_color,
    non_taxable_status, living_units
FROM properties;
