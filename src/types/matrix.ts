// ============================================
// 矩阵运营系统类型定义
// ============================================

/**
 * 账号人设定位
 */
export interface AccountPersona {
    id: string;
    xhs_account_id: string;
    supabase_uuid: string;
    persona: string;              // "种草达人" | "专业测评" | "品牌官方" | "生活分享" | 自定义
    content_style: string;        // 内容风格描述
    target_audience: string;      // 细分受众
    weekly_post_count: number;    // 每周发布数
    hashtags?: string[];          // 推荐标签
    created_at: string;
    updated_at: string;
}

/**
 * 矩阵策略
 */
export interface MatrixStrategy {
    id: string;
    supabase_uuid: string;
    product_id: string;
    accounts: AccountPersona[];
    overall_goal: string;         // 整体营销目标
    platform_tone: string;        // 平台调性
    created_at: string;
    updated_at: string;
}

/**
 * 矩阵周任务计划
 */
export interface MatrixWeeklyPlan {
    week_start_date: string;
    week_end_date: string;
    account_tasks: AccountWeeklyTasks[];
}

/**
 * 单账号周任务
 */
export interface AccountWeeklyTasks {
    xhs_account_id: string;
    account_name: string;
    persona: string;
    tasks: MatrixTask[];
}

/**
 * 矩阵任务
 */
export interface MatrixTask {
    id: string;
    xhs_account_id: string;
    supabase_uuid: string;
    scheduled_date: string;
    scheduled_time?: string;
    task_type: 'image_text' | 'video' | 'note';
    title: string;
    content_brief: string;
    content?: string;
    images?: string[];
    status: 'pending' | 'generating' | 'ready' | 'published' | 'failed';
    created_at: string;
    updated_at: string;
}

/**
 * AI 总控策略请求
 */
export interface GenerateStrategyRequest {
    supabase_uuid: string;
    product_name: string;
    product_description?: string;
    target_audience: string;
    marketing_goal: string;
    material_analysis?: string;
    accounts: {
        id: string;
        nickname?: string;
    }[];
}

/**
 * AI 总控策略响应
 */
export interface GenerateStrategyResponse {
    success: boolean;
    strategy?: MatrixStrategy;
    account_personas?: AccountPersona[];
    weekly_plan?: MatrixWeeklyPlan;
    error?: string;
}

/**
 * 预定义人设模板
 */
export const PERSONA_TEMPLATES = [
    { id: 'lifestyle', name: '生活分享', description: '分享真实生活体验，接地气' },
    { id: 'expert', name: '专业测评', description: '专业角度分析产品，有深度' },
    { id: 'influencer', name: '种草达人', description: '热情推荐，感染力强' },
    { id: 'brand', name: '品牌官方', description: '官方正式，权威可信' },
    { id: 'tutorial', name: '教程分享', description: '教用户如何使用产品' },
    { id: 'custom', name: '自定义', description: '自己设定人设' },
] as const;

/**
 * 预定义内容风格
 */
export const CONTENT_STYLES = [
    { id: 'warm', name: '温暖亲切' },
    { id: 'professional', name: '专业权威' },
    { id: 'humorous', name: '幽默风趣' },
    { id: 'minimalist', name: '简约清新' },
    { id: 'energetic', name: '活力四射' },
] as const;
