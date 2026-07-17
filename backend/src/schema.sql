-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools Table
CREATE TABLE IF NOT EXISTS schools (
    school_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    npsn VARCHAR(50) UNIQUE NOT NULL,
    district VARCHAR(100) NOT NULL,
    geo_lat DOUBLE PRECISION NOT NULL,
    geo_lng DOUBLE PRECISION NOT NULL,
    cluster_id INT NOT NULL DEFAULT 1
);

-- Users (Staff and Government roles)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'Admin', 'Dinas Analyst', 'Supervisor', 'Principal', 'Compliance Officer'
    district_scope VARCHAR(100) NOT NULL DEFAULT 'All', -- 'All' or specific district name, or school_id for Principal
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Official Indicators Table (Ingested from Dapodik/BOS/GTK etc.)
CREATE TABLE IF NOT EXISTS official_indicators (
    indicator_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL, -- 'dapodik', 'bos', 'gtk', 'accreditation', etc.
    period VARCHAR(20) NOT NULL,  -- e.g. '2026-07'
    field VARCHAR(100) NOT NULL,   -- e.g. 'teacher_attendance', 'student_ratio', etc.
    value DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_school_source_period_field UNIQUE (school_id, source, period, field)
);

-- Parents Table (Registered parents)
CREATE TABLE IF NOT EXISTS parents (
    parent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_hash VARCHAR(255) UNIQUE NOT NULL, -- Hashed phone number for privacy
    consent_status BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trust_score INT NOT NULL DEFAULT 50,    -- 0-100 score
    trust_tier VARCHAR(50) NOT NULL DEFAULT 'New', -- 'New', 'Standard', 'Trusted', 'Under Review'
    valid_report_count INT NOT NULL DEFAULT 0,
    spam_flag_count INT NOT NULL DEFAULT 0,
    duplicate_flag_count INT NOT NULL DEFAULT 0,
    identity_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- Parent-School Link Table (A parent can have children in multiple schools)
CREATE TABLE IF NOT EXISTS parent_schools (
    parent_id UUID REFERENCES parents(parent_id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, school_id)
);

-- Parent Pulse Responses Table (Survey submissions)
CREATE TABLE IF NOT EXISTS parent_pulse_responses (
    response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES parents(parent_id) ON DELETE SET NULL, -- Nullable for anonymized view
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL, -- e.g. '2026-07'
    topic_scores JSONB NOT NULL,  -- JSON mapping of the 9 survey topics to their scores
    free_text TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_parent_school_period UNIQUE (parent_id, school_id, period)
);

-- Complaints Table (Ad hoc complaints)
CREATE TABLE IF NOT EXISTS complaints (
    complaint_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES parents(parent_id) ON DELETE SET NULL, -- Nullable if fully anonymous
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    photo_url VARCHAR(512),
    category VARCHAR(100),
    urgency VARCHAR(50) DEFAULT 'Low', -- 'Low', 'Medium', 'High', 'Critical'
    sentiment VARCHAR(50) DEFAULT 'Neutral', -- 'Positive', 'Neutral', 'Negative'
    status VARCHAR(50) NOT NULL DEFAULT 'Received', -- 'Received', 'Acknowledged', 'In Progress', 'Resolved'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaint AI Metadata Table
CREATE TABLE IF NOT EXISTS complaint_ai_metadata (
    complaint_id UUID PRIMARY KEY REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    model_version VARCHAR(100) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    duplicate_of_id UUID REFERENCES complaints(complaint_id) ON DELETE SET NULL,
    review_status VARCHAR(50) NOT NULL DEFAULT 'Pending' -- 'Pending', 'Confirmed', 'Overridden'
);

-- School Health Scores History Table
CREATE TABLE IF NOT EXISTS health_scores (
    score_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL, -- e.g. '2026-07'
    composite_score DECIMAL(5, 2) NOT NULL,
    dimension_breakdown JSONB NOT NULL, -- Breakdown for academic, teacher, infrastructure, finance, parent satisfaction, student welfare, governance
    completeness_pct DECIMAL(5, 2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_school_period_health UNIQUE (school_id, period)
);

-- Ground Truth Flags Table (Detected inconsistencies)
CREATE TABLE IF NOT EXISTS ground_truth_flags (
    flag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    indicator VARCHAR(100) NOT NULL,
    official_value DECIMAL(10, 2) NOT NULL,
    parent_value DECIMAL(10, 2) NOT NULL,
    gap_score DECIMAL(5, 2) NOT NULL, -- z-score difference or raw gap
    period VARCHAR(20) NOT NULL,      -- e.g. '2026-07'
    status VARCHAR(50) NOT NULL DEFAULT 'Active', -- 'Active', 'Investigating', 'Resolved', 'Dismissed'
    explanation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_school_indicator_period UNIQUE (school_id, indicator, period)
);

-- Risk Alerts / Early Warning Cases Table
CREATE TABLE IF NOT EXISTS risk_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    trigger_type VARCHAR(100) NOT NULL, -- 'Threshold', 'Trend'
    severity VARCHAR(50) NOT NULL,      -- 'Low', 'Medium', 'High', 'Critical'
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'Open', -- 'Open', 'Investigated', 'Closed'
    resolution_note TEXT,
    resolved_by UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- Policy Simulations Table
CREATE TABLE IF NOT EXISTS simulations (
    simulation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    intervention_type VARCHAR(100) NOT NULL, -- 'add_teachers', 'increase_bos', 'infrastructure_investment'
    magnitude DECIMAL(12, 2) NOT NULL,
    projected_range JSONB NOT NULL,
    created_by UUID, -- REFERENCES users(user_id) - defined below
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommendations Table
CREATE TABLE IF NOT EXISTS recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period VARCHAR(20) NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    rank INT NOT NULL,
    rationale TEXT NOT NULL,
    score_components JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_school_period_recommendation UNIQUE (school_id, period)
);

-- Add ForeignKey constraint to simulations for users(user_id)
ALTER TABLE simulations ADD CONSTRAINT fk_simulations_user FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- Audit Logs Table (Immutable log of actions)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    target_entity VARCHAR(100) NOT NULL,
    target_id UUID,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create index for search performance
CREATE INDEX IF NOT EXISTS idx_official_indicators_school_period ON official_indicators(school_id, period);
CREATE INDEX IF NOT EXISTS idx_parent_pulse_school_period ON parent_pulse_responses(school_id, period);
CREATE INDEX IF NOT EXISTS idx_complaints_school ON complaints(school_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_school_period ON health_scores(school_id, period);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
