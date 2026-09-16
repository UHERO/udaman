-- mcp-only role (2026-09-16)
--
-- Accounts that exist only to authorize the UHERO Data MCP connector in
-- Claude. They can sign in (the OAuth consent step needs a session) and use
-- the public-data MCP tools; the site shows them a welcome page and nothing
-- else. See isMcpOnly in src/lib/auth/roles.ts.
--
-- Seeds an all-deny row per (resource, CRUD action) so the admin Permissions
-- matrix renders a full row for the role. Resource names match `resource:`
-- on each ROUTES entry in src/lib/auth/route-access.ts, the same set the
-- fellow migration seeded.

ALTER TABLE `users`
  MODIFY `role` ENUM('external','fsonly','internal','fellow','mcp-only','admin','dev') NOT NULL DEFAULT 'external';

ALTER TABLE `role_permissions`
  MODIFY `role` ENUM('external','fsonly','internal','fellow','mcp-only','admin','dev') NOT NULL;

INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`) VALUES('mcp-only', 'series', 'create', 0),('mcp-only', 'series', 'read', 0),('mcp-only', 'series', 'update', 0),('mcp-only', 'series', 'delete', 0),('mcp-only', 'analyze', 'create', 0),('mcp-only', 'analyze', 'read', 0),('mcp-only', 'analyze', 'update', 0),('mcp-only', 'analyze', 'delete', 0),('mcp-only', 'clipboard', 'create', 0),('mcp-only', 'clipboard', 'read', 0),('mcp-only', 'clipboard', 'update', 0),('mcp-only', 'clipboard', 'delete', 0),('mcp-only', 'catalog', 'create', 0),('mcp-only', 'catalog', 'read', 0),('mcp-only', 'catalog', 'update', 0),('mcp-only', 'catalog', 'delete', 0),('mcp-only', 'data-tools', 'create', 0),('mcp-only', 'data-tools', 'read', 0),('mcp-only', 'data-tools', 'update', 0),('mcp-only', 'data-tools', 'delete', 0),('mcp-only', 'investigation', 'create', 0),('mcp-only', 'investigation', 'read', 0),('mcp-only', 'investigation', 'update', 0),('mcp-only', 'investigation', 'delete', 0),('mcp-only', 'forecast-snapshot', 'create', 0),('mcp-only', 'forecast-snapshot', 'read', 0),('mcp-only', 'forecast-snapshot', 'update', 0),('mcp-only', 'forecast-snapshot', 'delete', 0),('mcp-only', 'upload', 'create', 0),('mcp-only', 'upload', 'read', 0),('mcp-only', 'upload', 'update', 0),('mcp-only', 'upload', 'delete', 0),('mcp-only', 'download', 'create', 0),('mcp-only', 'download', 'read', 0),('mcp-only', 'download', 'update', 0),('mcp-only', 'download', 'delete', 0),('mcp-only', 'export', 'create', 0),('mcp-only', 'export', 'read', 0),('mcp-only', 'export', 'update', 0),('mcp-only', 'export', 'delete', 0),('mcp-only', 'admin', 'create', 0),('mcp-only', 'admin', 'read', 0),('mcp-only', 'admin', 'update', 0),('mcp-only', 'admin', 'delete', 0),('mcp-only', 'hhdb', 'create', 0),('mcp-only', 'hhdb', 'read', 0),('mcp-only', 'hhdb', 'update', 0),('mcp-only', 'hhdb', 'delete', 0),('mcp-only', 'approval', 'create', 0),('mcp-only', 'approval', 'read', 0),('mcp-only', 'approval', 'update', 0),('mcp-only', 'approval', 'delete', 0),('mcp-only', 'docs', 'create', 0),('mcp-only', 'docs', 'read', 0),('mcp-only', 'docs', 'update', 0),('mcp-only', 'docs', 'delete', 0),('mcp-only', 'data-registry', 'create', 0),('mcp-only', 'data-registry', 'read', 0),('mcp-only', 'data-registry', 'update', 0),('mcp-only', 'data-registry', 'delete', 0) ON DUPLICATE KEY UPDATE `allowed` = VALUES(`allowed`), `updated_at` = NOW();
