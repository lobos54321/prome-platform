// ============================================
// 舆情分析系统类型定义 (BettaFish Integration)
// ============================================

/**
 * 趋势分析结果
 */
export interface TrendAnalysis {
    // 热门话题
    hotTopics: HotTopic[];

    // 情感倾向
    overallSentiment: {
        positive: number;  // 0-1
        neutral: number;
        negative: number;
    };

    // 受众洞察
    audienceInsights: {
        demographics: string[];
        interests: string[];
        activeTimeSlots: string[];
        platforms: PlatformActivity[];
    };

    // 内容机会
    contentOpportunities: ContentOpportunity[];

    // 竞品动态
    competitorInsights: CompetitorInsight[];

    // 时间戳
    analyzedAt: string;
    dataSourceCount: number;
}

/**
 * 热门话题
 */
export interface HotTopic {
    topic: string;
    heat: number;  // 热度分数 0-100
    trend: 'rising' | 'stable' | 'declining';
    relatedKeywords: string[];
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    platforms: string[];
    sampleContent?: string;
}

/**
 * 平台活跃度
 */
export interface PlatformActivity {
    platform: 'xiaohongshu' | 'weibo' | 'douyin' | 'kuaishou' | 'x' | 'tiktok';
    mentionCount: number;
    engagementRate: number;
    topHashtags: string[];
}

/**
 * 内容机会
 */
export interface ContentOpportunity {
    type: 'trending_topic' | 'gap_in_market' | 'seasonal_event' | 'competitor_weakness';
    title: string;
    description: string;
    suggestedAngle: string;
    urgency: 'high' | 'medium' | 'low';
    estimatedImpact: number;  // 0-100
}

/**
 * 竞品洞察
 */
export interface CompetitorInsight {
    competitor: string;
    recentActivity: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    strength: string;
    weakness: string;
}

/**
 * BettaFish API 请求
 */
export interface BettaFishRequest {
    query: string;  // 分析需求
    productName?: string;
    industry?: string;
    competitors?: string[];
    platforms?: string[];
    timeRange?: 'day' | 'week' | 'month';
}

/**
 * BettaFish API 响应
 */
export interface BettaFishResponse {
    success: boolean;
    sessionId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: TrendAnalysis;
    reportUrl?: string;
    error?: string;
}

/**
 * 内容效果数据
 */
export interface ContentPerformance {
    contentId: string;
    title: string;
    publishedAt: string;
    platform: string;

    // 核心指标
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;  // 收藏

    // 衍生指标
    engagementRate: number;  // (likes + comments + shares) / views
    conversionRate?: number;  // 如果有转化追踪

    // 时间序列
    hourlyViews?: { hour: number; count: number }[];

    // AI 分析
    performanceLevel: 'excellent' | 'good' | 'average' | 'poor';
    insights: string[];
    suggestedImprovements: string[];
}

/**
 * 策略进化记录
 */
export interface StrategyEvolution {
    id: string;
    cycleNumber: number;
    startDate: string;
    endDate: string;

    // 数据收集
    contentAnalyzed: number;
    totalViews: number;
    totalEngagement: number;

    // AI 分析结论
    topPerformingContent: string[];
    underperformingPatterns: string[];
    audienceFeedback: string[];

    // 策略调整
    personaAdjustments: {
        accountId: string;
        oldPersona: string;
        newPersona: string;
        reason: string;
    }[];

    contentStrategyUpdates: {
        metric: string;
        oldValue: any;
        newValue: any;
        reason: string;
    }[];

    // 下一周期目标
    nextCycleGoals: string[];
}

/**
 * BettaFish API 配置
 */
export const BETTAFISH_CONFIG = {
    baseUrl: 'https://weibo-sentiment-app.zeabur.app',
    endpoints: {
        analyze: '/api/analyze',
        status: '/api/status',
        report: '/api/report'
    }
};
