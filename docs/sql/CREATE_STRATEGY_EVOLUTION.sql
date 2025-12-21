-- 策略演化历史表
-- 记录每个周期的策略调整和效果

CREATE TABLE IF NOT EXISTS xhs_strategy_evolution (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supabase_uuid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    xhs_user_id TEXT NOT NULL,
    
    -- 周期信息
    cycle_number INTEGER NOT NULL DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- 数据收集
    content_analyzed INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    
    -- AI 分析结论
    top_performing_content TEXT[] DEFAULT '{}',
    underperforming_patterns TEXT[] DEFAULT '{}',
    audience_feedback TEXT[] DEFAULT '{}',
    
    -- 策略调整
    persona_adjustments JSONB DEFAULT '[]',
    content_strategy_updates JSONB DEFAULT '[]',
    
    -- 下一周期目标
    next_cycle_goals TEXT[] DEFAULT '{}',
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_strategy_evolution_user 
    ON xhs_strategy_evolution(xhs_user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_evolution_cycle 
    ON xhs_strategy_evolution(xhs_user_id, cycle_number);

-- 唯一约束：每个用户每个周期只有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_evolution_unique 
    ON xhs_strategy_evolution(xhs_user_id, cycle_number);

-- RLS 策略
ALTER TABLE xhs_strategy_evolution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evolution history" ON xhs_strategy_evolution
    FOR SELECT USING (supabase_uuid = auth.uid());

CREATE POLICY "Users can insert own evolution" ON xhs_strategy_evolution
    FOR INSERT WITH CHECK (supabase_uuid = auth.uid());

CREATE POLICY "Users can update own evolution" ON xhs_strategy_evolution
    FOR UPDATE USING (supabase_uuid = auth.uid());

-- 服务角色访问
CREATE POLICY "Service role full access" ON xhs_strategy_evolution
    FOR ALL USING (true);
