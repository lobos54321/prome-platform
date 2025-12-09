// ============================================
// 内容创作系统类型定义
// ============================================

/**
 * 内容形式
 */
export type ContentFormat = 'image_text' | 'video';

/**
 * 视频类型
 */
export type VideoType =
    | 'digital_avatar'  // 数字人口播 (45算力/分钟)
    | 'digital_mix'     // 数字人混剪 (60算力/分钟)
    | 'real_mix'        // 真人口播混剪 (15算力/分钟)
    | 'material_mix'    // 素材混剪 (15算力/分钟)
    | 'news_style'      // 新闻体视频 (6算力/分钟)
    | 'ugc_n8n';        // 真人UGC (n8n工作流)

/**
 * 营销目标
 */
export type MarketingGoal =
    | 'awareness'    // 提高认知
    | 'consideration' // 解决疑惑/说服
    | 'conversion';   // 直接销售

/**
 * 视频参数配置
 */
export interface VideoConfig {
    duration: 16 | 24 | 32;           // 视频时长(秒)
    gender: 'male' | 'female';        // 人物性别
    language: 'zh-CN' | 'en-US' | 'ja-JP';  // 语言
}

/**
 * 内容创作请求
 */
export interface ContentCreationRequest {
    // 产品信息 (从ConfigSection导入)
    productName: string;
    productDescription: string;
    targetAudience: string;
    productImages: string[];
    materialAnalysis?: string;

    // 文案参数
    marketingGoal: MarketingGoal;
    wordCount: number;
    platform: 'xiaohongshu' | 'douyin' | 'x' | 'tiktok';

    // 内容形式
    contentFormat: ContentFormat;
    videoType?: VideoType;
    videoConfig?: VideoConfig;

    // 账号信息
    accountId?: string;
    accountPersona?: string;
}

/**
 * 文案生成结果
 */
export interface CopywriteResult {
    title: string;
    titleVariants: string[];
    hook: string;
    painPoints: string[];
    solution: string;
    callToAction: string;
    fullContent: string;
    hashtags: string[];
    wordCount: number;
    psychologyWeapons: string[];
}

/**
 * 视频生成结果
 */
export interface VideoResult {
    videoUrl: string;
    thumbnailUrl?: string;
    duration: number;
    creditsUsed: number;
}

/**
 * 内容创作结果
 */
export interface ContentCreationResult {
    id: string;
    status: 'generating' | 'ready' | 'failed';

    // 文案
    copywrite?: CopywriteResult;

    // 视频 (如有)
    video?: VideoResult;

    // 图文 (如有)
    images?: string[];

    createdAt: string;
    error?: string;
}

/**
 * 视频类型配置
 */
export const VIDEO_TYPE_CONFIG: Record<VideoType, {
    name: string;
    description: string;
    creditsPerMinute: number;
    recommended: string[];
}> = {
    digital_avatar: {
        name: '数字人口播',
        description: '纯数字人口播，无标题字幕包装',
        creditsPerMinute: 45,
        recommended: ['brand', 'expert']
    },
    digital_mix: {
        name: '数字人混剪',
        description: '数字人+素材混剪一键包装',
        creditsPerMinute: 60,
        recommended: ['expert', 'tutorial']
    },
    real_mix: {
        name: '真人口播混剪',
        description: '真人口播视频+素材混剪一键包装',
        creditsPerMinute: 15,
        recommended: ['influencer', 'lifestyle']
    },
    material_mix: {
        name: '素材混剪',
        description: '文案+AI语音+多场景素材混剪',
        creditsPerMinute: 15,
        recommended: ['lifestyle', 'brand']
    },
    news_style: {
        name: '新闻体视频',
        description: '场景素材+文案一键包装',
        creditsPerMinute: 6,
        recommended: ['brand']
    },
    ugc_n8n: {
        name: '真人UGC',
        description: 'n8n工作流 + Google Veo 3',
        creditsPerMinute: 220, // 3528/16秒估算
        recommended: ['influencer', 'lifestyle']
    }
};

/**
 * UGC 视频费用
 */
export const UGC_CREDITS: Record<16 | 24 | 32, number> = {
    16: 3528,
    24: 5292,
    32: 7056
};
