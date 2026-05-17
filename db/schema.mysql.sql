SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  redmine_user_id INT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(201) GENERATED ALWAYS AS (CONCAT(first_name, ' ', last_name)) STORED,
  email VARCHAR(255) NULL,
  avatar_url VARCHAR(500) NULL,
  avatar_color VARCHAR(16) NULL,
  username VARCHAR(64) NULL,
  role ENUM('member','lead','manager','admin') NOT NULL DEFAULT 'member',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_redmine (redmine_user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  redmine_api_key VARCHAR(80) NULL,
  expires_at DATETIME NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_exp (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  lead_user_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_teams_lead (lead_user_id),
  CONSTRAINT fk_teams_lead FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
  team_id VARCHAR(32) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, user_id),
  KEY idx_team_members_user (user_id),
  CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(16) NOT NULL,
  label VARCHAR(64) NOT NULL,
  color_class VARCHAR(32) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS priorities (
  id VARCHAR(16) NOT NULL,
  label VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL,
  color_class VARCHAR(32) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS statuses (
  id VARCHAR(16) NOT NULL,
  label VARCHAR(64) NOT NULL,
  is_terminal TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  color_class VARCHAR(32) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  source ENUM('redmine','internal') NOT NULL DEFAULT 'internal',
  redmine_project_id INT NULL,
  redmine_identifier VARCHAR(100) NULL,
  owner_team_id VARCHAR(32) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_projects_redmine (redmine_project_id),
  UNIQUE KEY uq_projects_identifier (redmine_identifier),
  KEY idx_projects_source (source),
  KEY idx_projects_team (owner_team_id),
  CONSTRAINT fk_projects_team FOREIGN KEY (owner_team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redmine_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  redmine_issue_id INT NOT NULL,
  issue_key VARCHAR(64) NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  parent_ticket_id BIGINT UNSIGNED NULL,
  title VARCHAR(500) NOT NULL,
  status_id VARCHAR(16) NULL,
  priority_id VARCHAR(16) NULL,
  progress INT NOT NULL DEFAULT 0,
  start_date DATE NULL,
  due_date DATE NULL,
  estimated_hours DECIMAL(8,2) NULL,
  logged_hours DECIMAL(8,2) NULL,
  last_synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rt_issue (redmine_issue_id),
  KEY idx_rt_project (project_id),
  KEY idx_rt_parent (parent_ticket_id),
  KEY idx_rt_key (issue_key),
  CONSTRAINT chk_rt_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT fk_rt_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_rt_parent FOREIGN KEY (parent_ticket_id) REFERENCES redmine_tickets(id) ON DELETE SET NULL,
  CONSTRAINT fk_rt_status FOREIGN KEY (status_id) REFERENCES statuses(id),
  CONSTRAINT fk_rt_priority FOREIGN KEY (priority_id) REFERENCES priorities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redmine_ticket_assignees (
  ticket_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (ticket_id, user_id),
  KEY idx_rta_user (user_id),
  CONSTRAINT fk_rta_ticket FOREIGN KEY (ticket_id) REFERENCES redmine_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_rta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  team_id VARCHAR(32) NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  category_id VARCHAR(16) NOT NULL,
  priority_id VARCHAR(16) NOT NULL DEFAULT 'medium',
  status_id VARCHAR(16) NOT NULL DEFAULT 'working',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  progress INT NOT NULL DEFAULT 0,
  start_date DATE NULL,
  due_date DATE NULL,
  redmine_ticket_id BIGINT UNSIGNED NULL,
  last_redmine_sync_at DATETIME NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_tasks_team (team_id, deleted_at),
  KEY idx_tasks_priority (priority_id, deleted_at),
  KEY idx_tasks_category (category_id, deleted_at),
  KEY idx_tasks_due (due_date, deleted_at),
  KEY idx_tasks_redmine (redmine_ticket_id),
  KEY idx_tasks_project (project_id),
  CONSTRAINT chk_tasks_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT fk_tasks_team FOREIGN KEY (team_id) REFERENCES teams(id),
  CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_tasks_priority FOREIGN KEY (priority_id) REFERENCES priorities(id),
  CONSTRAINT fk_tasks_status FOREIGN KEY (status_id) REFERENCES statuses(id),
  CONSTRAINT fk_tasks_redmine FOREIGN KEY (redmine_ticket_id) REFERENCES redmine_tickets(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_created FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_updated FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_assignments (
  task_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  source ENUM('manual','redmine') NOT NULL DEFAULT 'manual',
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, user_id),
  KEY idx_ta_user (user_id),
  CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(32) NOT NULL,
  diff JSON NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_task (task_id),
  KEY idx_audit_time (occurred_at),
  CONSTRAINT fk_audit_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categories (id, label, color_class, sort_order) VALUES
  ('dev', 'Development', 'chip-dev', 10),
  ('cust', 'Customer', 'chip-cust', 20),
  ('ops', 'Operations', 'chip-ops', 30),
  ('hr', 'HR', 'chip-hr', 40)
ON DUPLICATE KEY UPDATE label = VALUES(label), color_class = VALUES(color_class), sort_order = VALUES(sort_order);

INSERT INTO priorities (id, label, sort_order, color_class) VALUES
  ('critical', 'Critical', 10, 'pri-critical'),
  ('high', 'High', 20, 'pri-high'),
  ('medium', 'Medium', 30, 'pri-medium'),
  ('low', 'Low', 40, 'pri-low'),
  ('none', 'None', 50, 'pri-none')
ON DUPLICATE KEY UPDATE label = VALUES(label), sort_order = VALUES(sort_order), color_class = VALUES(color_class);

INSERT INTO statuses (id, label, is_terminal, sort_order, color_class) VALUES
  ('working', 'In progress', 0, 10, 'pill-working'),
  ('blocked', 'Blocked', 0, 20, 'pill-blocked'),
  ('onhold', 'On hold', 0, 30, 'pill-onhold'),
  ('done', 'Done', 1, 40, 'pill-done')
ON DUPLICATE KEY UPDATE label = VALUES(label), is_terminal = VALUES(is_terminal), sort_order = VALUES(sort_order), color_class = VALUES(color_class);

INSERT INTO teams (id, name) VALUES ('uem', 'UEM')
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1;

INSERT INTO projects (name, source, redmine_identifier, owner_team_id) VALUES
  ('product-uem 5.2.0 GA', 'redmine', 'product-uem', 'uem'),
  ('Product IOTS', 'redmine', 'product-iots', 'uem'),
  ('Backlog', 'redmine', 'backlog', NULL),
  ('Internal · HR', 'internal', 'internal-hr', NULL),
  ('Internal · Operations', 'internal', 'internal-ops', NULL),
  ('Customer · ACME Roll-out', 'internal', 'customer-acme', 'uem')
ON DUPLICATE KEY UPDATE name = VALUES(name), source = VALUES(source), owner_team_id = VALUES(owner_team_id), is_active = 1;
