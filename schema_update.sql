-- =============================================================================
-- UNIV-Resolve Database Migration: SLA, Priority, Starvation Prevention & ETR
-- Additive Schema Updates (Zero Data Loss - Compatible with PostgreSQL & MySQL)
-- =============================================================================

-- ── 1. POSTGRESQL (Current active database: Neon Cloud PostgreSQL) ───────────

-- Priority & Starvation Prevention fields for issues
ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'LOW';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS base_priority_score INT DEFAULT 10;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS current_priority_score INT DEFAULT 10;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority_updated_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS estimated_duration_minutes BIGINT;

-- Priority & Starvation Prevention queue fields for task_assignments
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'LOW';
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS base_priority_score INT DEFAULT 10;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS current_priority_score INT DEFAULT 10;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS issue_created_at TIMESTAMP;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS priority_updated_at TIMESTAMP;

-- Backward compatibility & SLA fields
ALTER TABLE issues ADD COLUMN IF NOT EXISTS original_priority VARCHAR(20) DEFAULT 'LOW';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS effective_priority VARCHAR(20) DEFAULT 'LOW';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority_score INT DEFAULT 10;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS aging_score INT DEFAULT 0;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS severity VARCHAR(20);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS impact VARCHAR(30);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS affected_students INT DEFAULT 1;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS sla_target_hours INT DEFAULT 48;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'ON_TRACK';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS sla_breached_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS estimated_resolution_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS estimated_remaining_minutes BIGINT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS actual_resolution_minutes BIGINT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS prediction_method VARCHAR(50);

-- Helpful performance indexes
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_effective_prio ON issues(effective_priority);
CREATE INDEX IF NOT EXISTS idx_issues_sla_status ON issues(sla_status);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);

-- Data normalization for existing resolved complaints
UPDATE issues
SET
    sla_status = 'RESOLVED',
    estimated_remaining_minutes = 0,
    resolved_at = COALESCE(resolved_at, created_at + INTERVAL '2 hour'),
    actual_resolution_minutes = COALESCE(actual_resolution_minutes, 120),
    original_priority = COALESCE(original_priority, 'LOW'),
    effective_priority = COALESCE(effective_priority, 'LOW')
WHERE LOWER(status) = 'resolved';

-- ── 2. MYSQL / MARIADB EQUIVALENT STATEMENTS ────────────────────────────────

/*
ALTER TABLE issues
    ADD COLUMN IF NOT EXISTS original_priority VARCHAR(20) DEFAULT 'LOW',
    ADD COLUMN IF NOT EXISTS effective_priority VARCHAR(20) DEFAULT 'LOW',
    ADD COLUMN IF NOT EXISTS priority_score INT DEFAULT 10,
    ADD COLUMN IF NOT EXISTS aging_score INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS severity VARCHAR(20),
    ADD COLUMN IF NOT EXISTS impact VARCHAR(30),
    ADD COLUMN IF NOT EXISTS affected_students INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
    ADD COLUMN IF NOT EXISTS sla_target_hours INT DEFAULT 48,
    ADD COLUMN IF NOT EXISTS sla_due_at DATETIME,
    ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'ON_TRACK',
    ADD COLUMN IF NOT EXISTS sla_breached_at DATETIME,
    ADD COLUMN IF NOT EXISTS estimated_resolution_at DATETIME,
    ADD COLUMN IF NOT EXISTS estimated_remaining_minutes BIGINT,
    ADD COLUMN IF NOT EXISTS actual_resolution_minutes BIGINT,
    ADD COLUMN IF NOT EXISTS resolved_at DATETIME,
    ADD COLUMN IF NOT EXISTS prediction_method VARCHAR(50);

CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_effective_prio ON issues(effective_priority);
CREATE INDEX idx_issues_sla_status ON issues(sla_status);
CREATE INDEX idx_issues_created_at ON issues(created_at);

UPDATE issues
SET
    sla_status = 'RESOLVED',
    estimated_remaining_minutes = 0,
    resolved_at = IFNULL(resolved_at, DATE_ADD(created_at, INTERVAL 2 HOUR)),
    actual_resolution_minutes = IFNULL(actual_resolution_minutes, 120),
    original_priority = IFNULL(original_priority, 'LOW'),
    effective_priority = IFNULL(effective_priority, 'LOW')
WHERE LOWER(status) = 'resolved';
*/
