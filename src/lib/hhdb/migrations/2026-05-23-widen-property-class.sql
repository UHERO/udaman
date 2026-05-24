-- Widen property_class from VARCHAR(50) to VARCHAR(255).
-- QPub returns compound classifications like
-- "RESIDENTIAL; AGRICULTURAL (Multiple Property Classes on Parcel)"
-- which exceed 50 characters and cause "Data too long" errors.

ALTER TABLE properties MODIFY COLUMN property_class VARCHAR(255);
ALTER TABLE parcels MODIFY COLUMN property_class VARCHAR(255);
ALTER TABLE assessments MODIFY COLUMN property_class VARCHAR(255);
ALTER TABLE commercial_improvements MODIFY COLUMN property_class VARCHAR(255);
ALTER TABLE appeals MODIFY COLUMN tax_payer_opinion_of_property_class VARCHAR(255);
