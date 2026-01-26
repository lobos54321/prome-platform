-- 工作流结果表 - 保存生成的内容
CREATE TABLE IF NOT EXISTS workflow_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id VARCHAR(255) NOT NULL,

    -- 工作流类型和状态
    workflow_mode VARCHAR(50) NOT NULL DEFAULT 'image_text', -- image_text, avatar_video, ugc_video
    status VARCHAR(50) NOT NULL DEFAULT 'completed', -- pending, processing, completed, failed
    overall_progress INTEGER DEFAULT 100,

    -- 生成的内容结果 (JSON)
    result JSONB NOT NULL DEFAULT '{}',
    -- result 结构示例:
    -- {
    --   "title": "标题",
    --   "text": "正文内容",
    --   "hashtags": ["#标签1", "#标签2"],
    --   "images": ["url1", "url2"],
    --   "variants": [
    --     {"platform": "xiaohongshu", "content": "..."},
    --     {"platform": "x", "content": "..."}
    --   ],
    --   "engine": "Claude 4.5 Haiku"
    -- }

    -- 节点状态 (JSON)
    nodes JSONB DEFAULT '[]',

    -- 内容策略和周计划
    content_strategy JSONB DEFAULT NULL,
    weekly_plan JSONB DEFAULT NULL,

    -- 元数据
    target_platforms TEXT[] DEFAULT ARRAY['xiaohongshu'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_workflow_results_user_id ON workflow_results(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_results_task_id ON workflow_results(task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_results_created_at ON workflow_results(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_results_user_task ON workflow_results(user_id, task_id);

-- 启用 RLS
ALTER TABLE workflow_results ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY workflow_results_select_policy ON workflow_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY workflow_results_insert_policy ON workflow_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY workflow_results_update_policy ON workflow_results
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY workflow_results_delete_policy ON workflow_results
    FOR DELETE USING (auth.uid() = user_id);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_workflow_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_results_updated_at
    BEFORE UPDATE ON workflow_results
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_results_updated_at();

-- 授权 service role 完全访问
GRANT ALL ON workflow_results TO service_role;
GRANT ALL ON workflow_results TO authenticated;
