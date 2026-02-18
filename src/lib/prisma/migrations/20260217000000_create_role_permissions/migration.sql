CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role` ENUM('external','fsonly','internal','admin','dev') NOT NULL,
  `resource` VARCHAR(50) CHARACTER SET latin1 NOT NULL DEFAULT '*',
  `action` VARCHAR(50) CHARACTER SET latin1 NOT NULL DEFAULT '*',
  `allowed` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME DEFAULT NOW(),
  `updated_at` DATETIME DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_resource_action` (`role`, `resource`, `action`)
) DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;

-- dev: full access
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`) VALUES ('dev', '*', '*', 1);
-- admin: full access
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`) VALUES ('admin', '*', '*', 1);
-- internal: read + create + update + execute (no delete)
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`) VALUES
  ('internal', '*', 'read', 1), ('internal', '*', 'create', 1),
  ('internal', '*', 'update', 1), ('internal', '*', 'execute', 1);
-- fsonly + external: read-only
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`) VALUES ('fsonly', '*', 'read', 1);
INSERT INTO `role_permissions` (`role`, `resource`, `action`, `allowed`) VALUES ('external', '*', 'read', 1);
