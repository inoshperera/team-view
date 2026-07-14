-- ============================================================================
-- Team Activity Planner — High-level Tasks schema (MySQL 8)
-- Replaces team-config.local.json: teams + members live in the DB so the
-- view can render team / lead names, manage roles, and audit changes.
-- Redmine ids are preserved so the existing drill-down keeps working.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- USERS  (people in the org — assignees, leads, managers, admins)
-- redmine_user_id is THE identity bridge to Redmine.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  redmine_user_id INT              NULL,                       -- e.g. 14, 11, 104
  first_name      VARCHAR(100)     NOT NULL,
  last_name       VARCHAR(100)     NOT NULL,
  display_name    VARCHAR(201)
                  GENERATED ALWAYS AS (CONCAT(first_name, ' ', last_name)) STORED,
  email           VARCHAR(255)     NULL,
  avatar_color    VARCHAR(16)      NULL,                       -- UI hint, e.g. 'av-a'

  -- Auth identity. Passwords are NEVER stored — auth is delegated to
  -- the organisation's OpenLDAP at login time. `username` is the LDAP
  -- uid we map an authenticated bind back to a local user row.
  username        VARCHAR(64)      NULL,
  role            ENUM('member','lead','manager','admin') NOT NULL DEFAULT 'member',

  is_active       TINYINT(1)       NOT NULL DEFAULT 1,
  last_login_at   DATETIME         NULL,
  created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_redmine  (redmine_user_id),
  UNIQUE KEY uq_users_email    (email),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role           (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Server-side sessions. Skip if you go stateless JWT.
CREATE TABLE user_sessions (
  id            CHAR(36)     NOT NULL,                         -- UUID()
  user_id       BIGINT UNSIGNED NOT NULL,
  token_hash    VARCHAR(255) NOT NULL,
  expires_at    DATETIME     NOT NULL,
  user_agent    VARCHAR(255) NULL,
  ip_address    VARCHAR(45)  NULL,                             -- IPv4 / IPv6
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at  DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_exp  (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TEAMS  (replaces team-config.local.json)
-- Keeps string ids ('uem','gc',…) so existing references still resolve.
-- ----------------------------------------------------------------------------
CREATE TABLE teams (
  id            VARCHAR(32)     NOT NULL,
  name          VARCHAR(120)    NOT NULL,
  description   VARCHAR(500)    NULL,
  lead_user_id  BIGINT UNSIGNED NULL,
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_teams_lead (lead_user_id),
  CONSTRAINT fk_teams_lead FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- M:N — a user can be in more than one team (shared platform engineers etc.)
CREATE TABLE team_members (
  team_id    VARCHAR(32)     NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  joined_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, user_id),
  KEY idx_team_members_user (user_id),
  CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- LOOKUP TABLES (could be ENUMs; tables let ops add buckets without code)
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
  id           VARCHAR(16)  NOT NULL,                          -- 'dev','cust','ops','hr'
  label        VARCHAR(64)  NOT NULL,
  color_class  VARCHAR(32)  NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE priorities (
  id           VARCHAR(16)  NOT NULL,                          -- 'critical' … 'none'
  label        VARCHAR(64)  NOT NULL,
  sort_order   INT          NOT NULL,                          -- 0=critical … 4=none
  color_class  VARCHAR(32)  NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE statuses (
  id           VARCHAR(16)  NOT NULL,                          -- 'working','blocked','onhold','done'
  label        VARCHAR(64)  NOT NULL,
  is_terminal  TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order   INT          NOT NULL DEFAULT 0,
  color_class  VARCHAR(32)  NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- PROJECTS  (Redmine-backed + internal-only)
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                VARCHAR(160)    NOT NULL,
  source              ENUM('redmine','internal') NOT NULL DEFAULT 'internal',
  redmine_project_id  INT             NULL,                    -- numeric Redmine id
  redmine_identifier  VARCHAR(100)    NULL,                    -- Redmine slug, e.g. 'product-uem'
  owner_team_id       VARCHAR(32)     NULL,
  is_active           TINYINT(1)      NOT NULL DEFAULT 1,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_projects_redmine    (redmine_project_id),
  UNIQUE KEY uq_projects_identifier (redmine_identifier),
  KEY idx_projects_source (source),
  KEY idx_projects_team   (owner_team_id),
  CONSTRAINT fk_projects_team FOREIGN KEY (owner_team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- REDMINE TICKETS  (cache of issues the planner cares about)
-- The sync worker pulls only issues linked from a task + their sub-tickets.
-- ----------------------------------------------------------------------------
CREATE TABLE redmine_tickets (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  redmine_issue_id  INT             NOT NULL,                  -- e.g. 12489
  issue_key         VARCHAR(64)     NOT NULL,                  -- e.g. 'PRODUCT-12489'
  project_id        BIGINT UNSIGNED NOT NULL,
  parent_ticket_id  BIGINT UNSIGNED NULL,

  title             VARCHAR(500)    NOT NULL,
  status_id         VARCHAR(16)     NULL,
  priority_id       VARCHAR(16)     NULL,
  progress          INT             NOT NULL DEFAULT 0,
  start_date        DATE            NULL,
  due_date          DATE            NULL,
  estimated_hours   DECIMAL(8,2)    NULL,
  logged_hours      DECIMAL(8,2)    NULL,

  last_synced_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rt_issue (redmine_issue_id),
  KEY idx_rt_project (project_id),
  KEY idx_rt_parent  (parent_ticket_id),
  KEY idx_rt_key     (issue_key),
  CONSTRAINT chk_rt_progress  CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT fk_rt_project    FOREIGN KEY (project_id)       REFERENCES projects(id),
  CONSTRAINT fk_rt_parent     FOREIGN KEY (parent_ticket_id) REFERENCES redmine_tickets(id) ON DELETE SET NULL,
  CONSTRAINT fk_rt_status     FOREIGN KEY (status_id)        REFERENCES statuses(id),
  CONSTRAINT fk_rt_priority   FOREIGN KEY (priority_id)      REFERENCES priorities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE redmine_ticket_assignees (
  ticket_id  BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (ticket_id, user_id),
  KEY idx_rta_user (user_id),
  CONSTRAINT fk_rta_ticket FOREIGN KEY (ticket_id) REFERENCES redmine_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_rta_user   FOREIGN KEY (user_id)   REFERENCES users(id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- HIGH-LEVEL TASKS  (the new entity)
-- redmine_ticket_id IS NULL  → manual; lead edits status/progress/dates/members
-- redmine_ticket_id IS NOT   → synced; worker overwrites those fields
-- ----------------------------------------------------------------------------
CREATE TABLE tasks (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  team_id               VARCHAR(32)     NOT NULL,
  project_id            BIGINT UNSIGNED NOT NULL,
  category_id           VARCHAR(16)     NOT NULL,
  priority_id           VARCHAR(16)     NOT NULL DEFAULT 'medium',
  status_id             VARCHAR(16)     NOT NULL DEFAULT 'working',

  title                 VARCHAR(255)    NOT NULL,
  description           TEXT            NULL,
  progress              INT             NOT NULL DEFAULT 0,
  start_date            DATE            NULL,
  due_date              DATE            NULL,

  redmine_ticket_id     BIGINT UNSIGNED NULL,
  last_redmine_sync_at  DATETIME        NULL,

  created_by_user_id    BIGINT UNSIGNED NULL,
  updated_by_user_id    BIGINT UNSIGNED NULL,
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME        NULL,                  -- soft delete

  PRIMARY KEY (id),
  KEY idx_tasks_team     (team_id, deleted_at),
  KEY idx_tasks_priority (priority_id, deleted_at),
  KEY idx_tasks_category (category_id, deleted_at),
  KEY idx_tasks_due      (due_date, deleted_at),
  KEY idx_tasks_redmine  (redmine_ticket_id),
  KEY idx_tasks_project  (project_id),

  CONSTRAINT chk_tasks_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT fk_tasks_team      FOREIGN KEY (team_id)            REFERENCES teams(id),
  CONSTRAINT fk_tasks_project   FOREIGN KEY (project_id)         REFERENCES projects(id),
  CONSTRAINT fk_tasks_category  FOREIGN KEY (category_id)        REFERENCES categories(id),
  CONSTRAINT fk_tasks_priority  FOREIGN KEY (priority_id)        REFERENCES priorities(id),
  CONSTRAINT fk_tasks_status    FOREIGN KEY (status_id)          REFERENCES statuses(id),
  CONSTRAINT fk_tasks_redmine   FOREIGN KEY (redmine_ticket_id)  REFERENCES redmine_tickets(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_created   FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_updated   FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Assigned members.
--   source='manual'  → picked in the UI (only allowed when not Redmine-linked)
--   source='redmine' → written by the sync worker (parent + sub-tickets union)
-- Sync worker truncates source='redmine' rows for the task and rewrites them.
CREATE TABLE task_assignments (
  task_id      BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  source       ENUM('manual','redmine') NOT NULL DEFAULT 'manual',
  assigned_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, user_id),
  KEY idx_ta_user (user_id),
  CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- AUDIT LOG  (optional but recommended)
-- ----------------------------------------------------------------------------
CREATE TABLE task_audit_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id     BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NULL,
  action      VARCHAR(32)     NOT NULL,                        -- 'created','updated','linked','unlinked','synced','deleted'
  diff        JSON            NULL,                            -- before/after per changed field
  occurred_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_task (task_id),
  KEY idx_audit_time (occurred_at),
  CONSTRAINT fk_audit_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SEED
-- ============================================================================
INSERT INTO categories (id, label, color_class, sort_order) VALUES
  ('dev',  'Development', 'chip-dev',  0),
  ('cust', 'Customer',    'chip-cust', 1),
  ('ops',  'Operations',  'chip-ops',  2),
  ('hr',   'HR',          'chip-hr',   3);

INSERT INTO priorities (id, label, sort_order, color_class) VALUES
  ('critical', 'Critical', 0, 'pri-critical'),
  ('high',     'High',     1, 'pri-high'),
  ('medium',   'Medium',   2, 'pri-medium'),
  ('low',      'Low',      3, 'pri-low'),
  ('none',     'None',     4, 'pri-none');

INSERT INTO statuses (id, label, is_terminal, sort_order, color_class) VALUES
  ('working', 'In progress', 0, 0, 'pill-working'),
  ('blocked', 'Blocked',     0, 1, 'pill-blocked'),
  ('onhold',  'On hold',     0, 2, 'pill-onhold'),
  ('done',    'Done',        1, 3, 'pill-done');

-- ============================================================================
-- IMPORT FROM team-config.local.json (example)
-- ============================================================================
-- INSERT INTO teams (id, name) VALUES ('uem','UEM'),('gc','GC');
-- INSERT INTO team_members (team_id, user_id)
-- SELECT 'uem', id FROM users WHERE redmine_user_id IN (14,11,104,20)
-- UNION ALL
-- SELECT 'gc',  id FROM users WHERE redmine_user_id IN (9,8);

-- ============================================================================
-- COMMON QUERIES (reference)
-- ============================================================================
-- 1) Team-lead dashboard — tasks for a team, priority-ordered
-- SELECT t.*, p.label AS priority_label, c.label AS category_label
-- FROM tasks t
-- JOIN priorities p ON p.id = t.priority_id
-- JOIN categories c ON c.id = t.category_id
-- WHERE t.team_id = ? AND t.deleted_at IS NULL
-- ORDER BY p.sort_order, t.due_date IS NULL, t.due_date;
--
-- 2) Manager dashboard — all tasks, optional member filter
-- SELECT DISTINCT t.* FROM tasks t
-- LEFT JOIN task_assignments a ON a.task_id = t.id
-- WHERE t.deleted_at IS NULL AND (? IS NULL OR a.user_id = ?);
--
-- 3) Sync worker — rewrite synced fields on linked tasks
-- UPDATE tasks t
-- JOIN redmine_tickets rt ON rt.id = t.redmine_ticket_id
-- SET t.status_id  = rt.status_id,
--     t.progress   = rt.progress,
--     t.start_date = rt.start_date,
--     t.due_date   = rt.due_date,
--     t.last_redmine_sync_at = NOW();
-- -- then for each linked task: DELETE FROM task_assignments WHERE task_id=? AND source='redmine';
-- -- and INSERT the union of parent + sub-ticket assignees with source='redmine'.
