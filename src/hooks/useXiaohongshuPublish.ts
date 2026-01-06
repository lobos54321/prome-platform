/**
 * useXiaohongshuPublish Hook
 * 
 * 可复用的小红书发布 Hook，封装了与 Chrome 插件的通信逻辑。
 * 提取自 XiaohongshuAutoManager.tsx
 * 
 * 功能：
 * 1. 检测 Chrome 浏览器和插件安装状态
 * 2. 通过 postMessage 与插件通信发布内容
 * 3. 接收发布结果（包含 feedId 用于数据追踪）
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// 发布内容类型
export interface PublishContent {
    title: string;
    content: string;
    images?: string[];
    video?: string;
    tags?: string[];
}

// 发布结果类型
export interface PublishResult {
    success: boolean;
    message: string;
    feedId?: string;
    xsecToken?: string;
    publishedUrl?: string;
    needRedirect?: boolean;
}

// Hook 配置
export interface UseXiaohongshuPublishOptions {
    // 发布成功后的回调
    onSuccess?: (result: PublishResult) => void;
    // 发布失败后的回调
    onError?: (error: Error) => void;
    // 超时时间（毫秒），默认 5 分钟
    timeout?: number;
}

// 插件下载地址
const EXTENSION_DOWNLOAD_URL = '/prome-extension.zip';

/**
 * 小红书发布 Hook
 * 
 * @example
 * ```tsx
 * const { hasExtension, isPublishing, publish } = useXiaohongshuPublish();
 * 
 * // 发布内容
 * const handlePublish = async () => {
 *   const result = await publish({
 *     title: '我的笔记',
 *     content: '笔记内容...',
 *     images: ['https://...'],
 *     tags: ['#话题1', '#话题2']
 *   });
 *   
 *   if (result.success) {
 *     console.log('发布成功，feedId:', result.feedId);
 *   }
 * };
 * ```
 */
export function useXiaohongshuPublish(options: UseXiaohongshuPublishOptions = {}) {
    const { onSuccess, onError, timeout = 300000 } = options;

    // 状态
    const [hasExtension, setHasExtension] = useState(false);
    const [isChrome, setIsChrome] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    // 用于清理的引用
    const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 检测浏览器和插件
    useEffect(() => {
        // 检测是否是 Chrome
        const isChromeBrowser = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        setIsChrome(isChromeBrowser);

        // 检测插件是否安装（插件会在页面注入一个标记元素）
        const checkExtension = () => {
            if (document.getElementById('prome-extension-installed')) {
                setHasExtension(true);
            }
        };

        checkExtension();
        const interval = setInterval(checkExtension, 1000);

        return () => clearInterval(interval);
    }, []);

    // 清理函数
    const cleanup = useCallback(() => {
        if (messageHandlerRef.current) {
            window.removeEventListener('message', messageHandlerRef.current);
            messageHandlerRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // 下载插件
    const downloadExtension = useCallback(() => {
        window.open(EXTENSION_DOWNLOAD_URL, '_blank');
    }, []);

    // 打开小红书发布页面
    const openPublishPage = useCallback((type: 'image' | 'video' = 'image') => {
        const url = type === 'video'
            ? 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=video'
            : 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=image';
        window.open(url, '_blank');
    }, []);

    // 发布内容
    const publish = useCallback(async (content: PublishContent): Promise<PublishResult> => {
        // 前置检查
        if (!hasExtension) {
            const error = new Error('未检测到 Prome 助手插件，请先安装插件');
            setLastError(error.message);
            onError?.(error);
            return { success: false, message: error.message };
        }

        if (!content.title?.trim()) {
            const error = new Error('标题不能为空');
            setLastError(error.message);
            onError?.(error);
            return { success: false, message: error.message };
        }

        setIsPublishing(true);
        setLastError(null);
        cleanup();

        try {
            // 构建发布数据
            const publishData = {
                title: content.title.trim(),
                content: content.content || '',
                images: content.images || [],
                video: content.video || null,
                tags: content.tags || [],
                publishType: content.video ? 'video' : 'image'
            };

            console.log('[useXiaohongshuPublish] Sending publish task:', publishData);

            // 创建等待插件响应的 Promise
            const publishPromise = new Promise<PublishResult>((resolve, reject) => {
                // 超时处理
                timeoutRef.current = setTimeout(() => {
                    cleanup();
                    reject(new Error('插件响应超时（5分钟），请确保已在小红书发布页面并登录'));
                }, timeout);

                // 消息处理器
                const handleMessage = (event: MessageEvent) => {
                    if (event.source !== window) return;

                    if (event.data.type === 'PROME_PUBLISH_RESULT') {
                        console.log('[useXiaohongshuPublish] Received result:', event.data);
                        cleanup();
                        resolve({
                            success: event.data.success || false,
                            message: event.data.message || '',
                            feedId: event.data.feedId || null,
                            xsecToken: event.data.xsecToken || null,
                            publishedUrl: event.data.publishedUrl || null,
                            needRedirect: event.data.needRedirect || false
                        });
                    }
                };

                messageHandlerRef.current = handleMessage;
                window.addEventListener('message', handleMessage);
            });

            // 发送发布任务到插件
            window.postMessage({
                type: 'PROME_PUBLISH_TASK',
                data: publishData
            }, '*');

            // 等待结果
            const result = await publishPromise;

            if (result.success) {
                onSuccess?.(result);
            } else if (result.message) {
                const error = new Error(result.message);
                setLastError(result.message);
                onError?.(error);
            }

            return result;

        } catch (error: any) {
            console.error('[useXiaohongshuPublish] Error:', error);
            setLastError(error.message);
            onError?.(error);
            return { success: false, message: error.message };
        } finally {
            setIsPublishing(false);
        }
    }, [hasExtension, timeout, onSuccess, onError, cleanup]);

    // 确认并发布（带用户确认弹窗）
    const confirmAndPublish = useCallback(async (content: PublishContent): Promise<PublishResult> => {
        // 检查插件
        if (!hasExtension) {
            const installConfirm = window.confirm(
                '未检测到 Prome 助手插件。\n\n' +
                '需要安装插件才能自动发布内容。\n\n' +
                '点击「确定」下载插件，或点击「取消」返回。'
            );

            if (installConfirm) {
                downloadExtension();
            }
            return { success: false, message: '未安装插件' };
        }

        // 确认发布
        const confirmed = window.confirm(
            `确认发布此内容到小红书？\n\n` +
            `标题：${content.title}\n\n` +
            `将通过浏览器插件自动发布。`
        );

        if (!confirmed) {
            return { success: false, message: '用户取消发布' };
        }

        // 提示用户
        window.alert(
            `📝 发布任务已发送到插件！\n\n` +
            `请确保：\n` +
            `1. 已在浏览器中打开小红书发布页面\n` +
            `   (creator.xiaohongshu.com/publish)\n` +
            `2. 已登录小红书账号\n\n` +
            `插件将自动完成发布操作。`
        );

        return publish(content);
    }, [hasExtension, downloadExtension, publish]);

    // 组件卸载时清理
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    return {
        // 状态
        hasExtension,
        isChrome,
        isPublishing,
        lastError,

        // 方法
        publish,
        confirmAndPublish,
        downloadExtension,
        openPublishPage
    };
}

export default useXiaohongshuPublish;
