-- Table: xhs_user_mapping
CREATE TABLE xhs_user_mapping (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_mapping_user_id ON xhs_user_mapping(user_id);

-- Table: xhs_user_profiles
CREATE TABLE xhs_user_profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    profile_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_user_id ON xhs_user_profiles(user_id);

-- Table: xhs_content_strategies
CREATE TABLE xhs_content_strategies (
    id SERIAL PRIMARY KEY,
    strategy_name VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: xhs_daily_tasks
CREATE TABLE xhs_daily_tasks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    task_description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_daily_tasks_user_id ON xhs_daily_tasks(user_id);

-- Table: xhs_weekly_plans
CREATE TABLE xhs_weekly_plans (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    plan_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: xhs_activity_logs
CREATE TABLE xhs_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: xhs_automation_status
CREATE TABLE xhs_automation_status (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies
ALTER TABLE xhs_user_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_mapping_policy ON xhs_user_mapping
    FOR SELECT
    USING (user_id = current_setting('my.auth.user_id'));

ALTER TABLE xhs_user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_profiles_policy ON xhs_user_profiles
    FOR SELECT
    USING (user_id = current_setting('my.auth.user_id'));

-- (Add RLS policies for other tables as needed)