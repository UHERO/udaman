-- Internal-only universes still render a data portal on prod, but only for
-- logged-in users (see src/app/data/[universe]/layout.tsx). Anonymous
-- visitors are sent back to the base portal, and the universe is left out of
-- the portal directory dialog. The REST API does not read this yet.
ALTER TABLE `universe` ADD COLUMN `internal_only` BOOLEAN NOT NULL DEFAULT FALSE AFTER `data_portal_url`;
