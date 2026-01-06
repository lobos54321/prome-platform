/**
 * publishApi - 前端发布 API 客户端
 * 
 * 调用后端 PublishService 管理多平台发布任务
 */

const API_BASE = import.meta.env.VITE_XHS_API_URL || 'http://localhost:8080';

export type Platform = 'xiaohongshu' | 'tiktok' | 'instagram' | 'youtube' | 'pinterest';
export type PublishStatus = 'pending' | 'queued' | 'publishing' | 'completed' | 'failed';
export type ContentType = 'image_text' | 'video';

export interface PublishTask {
    id: string;
    user_id: string;
    content_type: ContentType;
    title: string;
    content?: string;
    images?: string[];
    video_url?: string;
    tags?: string[];
    platform: Platform;
    method: 'chrome_extension' | 'skyvern';
    status: PublishStatus;
    platform_post_id?: string;
    published_url?: string;
    error_message?: string;
    created_at: string;
    published_at?: string;
}

export interface CreatePublishRequest {
    userId: string;
    contentId?: string;
    contentType: ContentType;
    title: string;
    content?: string;
    images?: string[];
    videoUrl?: string;
    tags?: string[];
    platforms: Platform[];
}

/**
 * 创建多平台发布任务
 */
export async function createPublishTasks(request: CreatePublishRequest): Promise<PublishTask[]> {
    const response = await fetch(`${API_BASE}/api/publish/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create publish tasks');
    }

    return response.json();
}

/**
 * 获取用户的发布任务列表
 */
export async function getPublishTasks(
    userId: string,
    options?: { platform?: Platform; status?: PublishStatus; limit?: number }
): Promise<PublishTask[]> {
    const params = new URLSearchParams({ userId });
    if (options?.platform) params.append('platform', options.platform);
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());

    const response = await fetch(`${API_BASE}/api/publish/tasks?${params}`);

    if (!response.ok) {
        throw new Error('Failed to get publish tasks');
    }

    return response.json();
}

/**
 * 通过 Skyvern 发布到平台
 */
export async function publishViaSkyvern(taskId: string): Promise<{ success: boolean; runId?: string; error?: string }> {
    const response = await fetch(`${API_BASE}/api/publish/skyvern/${taskId}`, {
        method: 'POST'
    });

    if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message };
    }

    const result = await response.json();
    return { success: true, runId: result.runId };
}

/**
 * 检查 Skyvern 任务状态
 */
export async function checkSkyvernStatus(taskId: string): Promise<{
    status: PublishStatus;
    postUrl?: string;
    error?: string;
}> {
    const response = await fetch(`${API_BASE}/api/publish/skyvern/${taskId}/status`);

    if (!response.ok) {
        throw new Error('Failed to check status');
    }

    return response.json();
}

/**
 * 获取平台配置
 */
export function getPlatformConfig(platform: Platform): {
    name: string;
    icon: string;
    method: 'chrome_extension' | 'skyvern';
    enabled: boolean;
} {
    const configs: Record<Platform, ReturnType<typeof getPlatformConfig>> = {
        xiaohongshu: { name: '小红书', icon: '📕', method: 'chrome_extension', enabled: true },
        tiktok: { name: 'TikTok', icon: '🎵', method: 'skyvern', enabled: true },
        instagram: { name: 'Instagram', icon: '📷', method: 'skyvern', enabled: true },
        youtube: { name: 'YouTube', icon: '▶️', method: 'skyvern', enabled: false },
        pinterest: { name: 'Pinterest', icon: '📌', method: 'skyvern', enabled: false }
    };

    return configs[platform];
}

export const publishApi = {
    createPublishTasks,
    getPublishTasks,
    publishViaSkyvern,
    checkSkyvernStatus,
    getPlatformConfig
};

export default publishApi;
