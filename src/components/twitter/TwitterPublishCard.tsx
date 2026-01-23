/**
 * TwitterPublishCard - Twitter/X 发布卡片组件
 *
 * 用于显示待发布的推文内容，并支持一键发布
 */
import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Send,
    Loader2,
    CheckCircle2,
    XCircle,
    Edit2,
    Copy,
    ExternalLink,
    Image as ImageIcon,
} from 'lucide-react';
import { twitterClient } from '@/lib/twitter-worker';

interface TwitterPublishCardProps {
    userId: string;
    contentId?: string;
    initialText: string;
    mediaUrls?: string[];
    cookies?: string;
    isLoggedIn?: boolean;
    onPublishSuccess?: (result: { taskId: string }) => void;
    onPublishError?: (error: string) => void;
}

export function TwitterPublishCard({
    userId,
    contentId,
    initialText,
    mediaUrls = [],
    cookies,
    isLoggedIn = false,
    onPublishSuccess,
    onPublishError,
}: TwitterPublishCardProps) {
    const [text, setText] = useState(initialText);
    const [isEditing, setIsEditing] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [taskId, setTaskId] = useState<string | null>(null);

    // 字符计数
    const charCount = text.length;
    const maxChars = 280;
    const isOverLimit = charCount > maxChars;

    // 复制文案
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
    };

    // 发布推文
    const handlePublish = async () => {
        if (!isLoggedIn || !cookies) {
            setErrorMessage('请先登录 Twitter');
            setStatus('error');
            onPublishError?.('未登录');
            return;
        }

        if (isOverLimit) {
            setErrorMessage('推文超过字数限制');
            setStatus('error');
            return;
        }

        try {
            setPublishing(true);
            setErrorMessage(null);

            const result = await twitterClient.publish({
                userId,
                cookies,
                text,
                mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            });

            if (result.status === 'started') {
                setTaskId(result.task_id);
                setStatus('success');
                onPublishSuccess?.({ taskId: result.task_id });
            } else {
                throw new Error(result.msg || '发布失败');
            }
        } catch (err) {
            console.error('Publish failed:', err);
            const msg = err instanceof Error ? err.message : '发布失败';
            setErrorMessage(msg);
            setStatus('error');
            onPublishError?.(msg);
        } finally {
            setPublishing(false);
        }
    };

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
                {/* Twitter 样式头部 */}
                <div className="flex items-center gap-2">
                    <span className="text-2xl">𝕏</span>
                    <span className="font-medium text-gray-700">推文预览</span>
                    {status === 'success' && (
                        <Badge className="ml-auto bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            已发送
                        </Badge>
                    )}
                    {status === 'error' && (
                        <Badge variant="destructive" className="ml-auto">
                            <XCircle className="h-3 w-3 mr-1" />
                            失败
                        </Badge>
                    )}
                </div>

                {/* 推文内容 */}
                {isEditing ? (
                    <div className="space-y-2">
                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="min-h-[120px] resize-none"
                            placeholder="有什么新鲜事？"
                        />
                        <div className="flex justify-between items-center">
                            <span className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                                {charCount}/{maxChars}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setText(initialText);
                                        setIsEditing(false);
                                    }}
                                >
                                    取消
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setIsEditing(false)}
                                >
                                    确定
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        className="p-3 bg-gray-50 rounded-lg min-h-[80px] cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setIsEditing(true)}
                    >
                        <p className="text-gray-800 whitespace-pre-wrap">{text}</p>
                        <div className="flex justify-between items-center mt-2">
                            <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
                                {charCount}/{maxChars} 字符
                            </span>
                            <Edit2 className="h-3 w-3 text-gray-400" />
                        </div>
                    </div>
                )}

                {/* 媒体预览 */}
                {mediaUrls.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                        {mediaUrls.slice(0, 4).map((url, i) => (
                            <div
                                key={i}
                                className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden"
                            >
                                <img
                                    src={url}
                                    alt={`Media ${i + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* 错误提示 */}
                {errorMessage && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                        {errorMessage}
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-4 pt-0 flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    title="复制文案"
                >
                    <Copy className="h-4 w-4" />
                </Button>

                {taskId && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open('https://x.com/home', '_blank')}
                        title="打开 Twitter"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                )}

                <Button
                    className="ml-auto bg-black hover:bg-gray-800"
                    size="sm"
                    onClick={handlePublish}
                    disabled={publishing || !isLoggedIn || isOverLimit || status === 'success'}
                >
                    {publishing ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            发送中...
                        </>
                    ) : status === 'success' ? (
                        <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            已发送
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4 mr-2" />
                            发送推文
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
