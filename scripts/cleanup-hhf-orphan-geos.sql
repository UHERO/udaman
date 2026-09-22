-- Find HHF geographies with no associated series
SELECT g.id, g.handle, g.display_name, g.geotype
FROM geographies g
LEFT JOIN series s ON s.geography_id = g.id AND s.universe = 'HHF'
WHERE g.universe = 'HHF'
  AND s.id IS NULL
ORDER BY g.handle;

-- Delete them (uncomment to run)
-- DELETE g FROM geographies g LEFT JOIN series s ON s.geography_id = g.id AND s.universe = 'HHF' WHERE g.universe = 'HHF' AND s.id IS NULL;
