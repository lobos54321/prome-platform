-- =============================================================================
-- 小红书矩阵账号架构 - 数据库迁移脚本
-- 支持一个 Prome 用户绑定多个小红书账号
-- =============================================================================

-- 1. 小红书账号主表
CREATE TABLE IF NOT EXISTS xhs_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 小红书身份信息
    xhs_session_hash TEXT UNIQUE NOT NULL,  -- web_session 哈希（稳定标识）
    xhs_real_user_id TEXT,                   -- 小红书真实用户ID（如能获取）
    
    -- 账号信息（从页面提取或用户输入）
    nickname TEXT,
    red_id TEXT,                             -- 小红书号
    avatar_url TEXT,
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xhs_accounts_session_hash ON xhs_accounts(xhs_session_hash);
CREATE INDEX IF NOT EXISTS idx_xhs_accounts_real_user_id ON xhs_accounts(xhs_real_user_id);

-- 2. 用户-账号绑定表（1:N 关系，支持矩阵）
CREATE TABLE IF NOT EXISTS user_xhs_account_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_uuid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    xhs_account_id UUID NOT NULL REFERENCES xhs_accounts(id) ON DELETE CASCADE,
    
    -- 绑定信息
    alias TEXT,                              -- 用户自定义别名
    is_default BOOLEAN DEFAULT false,        -- 是否为默认账号
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 每个用户每个账号只能绑定一次
    UNIQUE(supabase_uuid, xhs_account_id)
);

CREATE INDEX IF NOT EXISTS idx_bindings_supabase_uuid ON user_xhs_account_bindings(supabase_uuid);
CREATE INDEX IF NOT EXISTS idx_bindings_xhs_account ON user_xhs_account_bindings(xhs_account_id);

-- 3. 账号Cookie存储表
CREATE TABLE IF NOT EXISTS xhs_account_cookies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    xhs_account_id UUID NOT NULL REFERENCES xhs_accounts(id) ON DELETE CASCADE,
    
    cookies JSONB NOT NULL,
    cookie_count INT DEFAULT 0,
    cookie_size INT DEFAULT 0,
    
    is_valid BOOLEAN DEFAULT true,
    last_validated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 每个账号只有一份Cookie
    UNIQUE(xhs_account_id)
);

-- 4. 内容计划表 - 按账号隔离
-- (如果已有 xhs_daily_tasks，需要添加 xhs_account_id 列)
ALTER TABLE xhs_daily_tasks 
ADD COLUMN IF NOT EXISTS xhs_account_id UUID REFERENCES xhs_accounts(id);

-- 5. 内容策略表 - 按账号隔离
ALTER TABLE xhs_content_strategies
ADD COLUMN IF NOT EXISTS xhs_account_id UUID REFERENCES xhs_accounts(id);

-- 6. 用户配置表 - 按账号隔离
ALTER TABLE xhs_user_profiles
ADD COLUMN IF NOT EXISTS xhs_account_id UUID REFERENCES xhs_accounts(id);

-- =============================================================================
-- RLS 策略
-- =============================================================================

-- xhs_accounts 表
ALTER TABLE xhs_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their bound accounts" ON xhs_accounts
FOR SELECT USING (
    id IN (
        SELECT xhs_account_id FROM user_xhs_account_bindings
        WHERE supabase_uuid = auth.uid()
    )
);

CREATE POLICY "Service can manage all accounts" ON xhs_accounts
FOR ALL USING (true);

-- user_xhs_account_bindings 表
ALTER TABLE user_xhs_account_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bindings" ON user_xhs_account_bindings
FOR ALL USING (supabase_uuid = auth.uid())
WITH CHECK (supabase_uuid = auth.uid());

-- 限制每用户最多10个账号
CREATE OR REPLACE FUNCTION check_max_accounts()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM user_xhs_account_bindings WHERE supabase_uuid = NEW.supabase_uuid) >= 10 THEN
        RAISE EXCEPTION '每个用户最多绑定10个小红书账号';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_accounts ON user_xhs_account_bindings;
CREATE TRIGGER enforce_max_accounts
BEFORE INSERT ON user_xhs_account_bindings
FOR EACH ROW EXECUTE FUNCTION check_max_accounts();

-- xhs_account_cookies 表
ALTER TABLE xhs_account_cookies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their account cookies" ON xhs_account_cookies
FOR SELECT USING (
    xhs_account_id IN (
        SELECT xhs_account_id FROM user_xhs_account_bindings
        WHERE supabase_uuid = auth.uid()
    )
);

CREATE POLICY "Service can manage all cookies" ON xhs_account_cookies
FOR ALL USING (true);

-- =============================================================================
-- 更新触发器
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS xhs_accounts_updated_at ON xhs_accounts;
CREATE TRIGGER xhs_accounts_updated_at
BEFORE UPDATE ON xhs_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS xhs_account_cookies_updated_at ON xhs_account_cookies;
CREATE TRIGGER xhs_account_cookies_updated_at
BEFORE UPDATE ON xhs_account_cookies
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 注释
-- =============================================================================

COMMENT ON TABLE xhs_accounts IS '小红书账号表 - 存储真实小红书账号信息';
COMMENT ON TABLE user_xhs_account_bindings IS '用户-账号绑定表 - 支持1:N矩阵账号';
COMMENT ON TABLE xhs_account_cookies IS '账号Cookie表 - 按账号隔离存储';

COMMENT ON COLUMN xhs_accounts.xhs_session_hash IS 'web_session Cookie的哈希值，作为稳定的账号标识';
COMMENT ON COLUMN user_xhs_account_bindings.is_default IS '是否为用户的默认账号';
