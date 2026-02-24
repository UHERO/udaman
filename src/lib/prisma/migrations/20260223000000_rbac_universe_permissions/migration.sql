-- Add permission entries for universe-aware RBAC.
-- The coarse policy (enforceAccessPolicy) handles role+universe compound checks.
-- These DB entries ensure Gate 2 (PermissionCollection.isAllowed) also passes.

-- External role needs upload permissions (coarse policy handles universe check for DBEDT)
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`)
VALUES ('external', 'upload', 'create', 1),
       ('external', 'upload', 'read', 1)
ON DUPLICATE KEY UPDATE `allowed` = 1;

-- FSOnly needs forecast-snapshot read and export csv-download
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`)
VALUES ('fsonly', 'forecast-snapshot', 'read', 1),
       ('fsonly', 'export', 'csv-download', 1)
ON DUPLICATE KEY UPDATE `allowed` = 1;

-- Tighten internal: remove create/update/execute (keep only read:*)
-- Internal users should only read; writes require admin+ via coarse policy
UPDATE `role_permissions` SET `allowed` = 0
WHERE `role` = 'internal' AND `resource` = '*' AND `action` IN ('create', 'update', 'execute');

-- Explicit entries for renamed resources (admin/dev already have *:* but added for safety)
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`)
VALUES ('admin', 'export', '*', 1),
       ('admin', 'forecast-snapshot', '*', 1),
       ('admin', 'upload', '*', 1),
       ('dev', 'export', '*', 1),
       ('dev', 'forecast-snapshot', '*', 1),
       ('dev', 'upload', '*', 1)
ON DUPLICATE KEY UPDATE `allowed` = 1;
