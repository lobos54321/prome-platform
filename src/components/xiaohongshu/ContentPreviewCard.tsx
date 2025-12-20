import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Image as ImageIcon, Check, Edit, RefreshCw } from 'lucide-react';
import { VariantSelector } from './VariantSelector';

interface PublishJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  taskTitle?: string;
}

interface ContentPreviewCardProps {
  content?: {
    id?: string;
    title: string;
    content: string;
    scheduledTime: string;
    type: string;
    imageUrls?: string[];
    hashtags?: string[];
    status?: string;
    // 新增：变体选择相关
    goldenQuotes?: string[];
    copyStrategy?: 'variant' | 'split';
    copyVariants?: {
      motherCopy: { title: string; text: string };
      variants?: Array<{ type: string; title: string; text: string; estimatedWords?: number }>;
      segments?: Array<{ type: string; title: string; text: string; estimatedWords?: number }>;
    };
  } | null;
  publishJob?: PublishJobStatus | null;
  /** 是否为审核模式 (true=用户选择变体, false=自动选择) */
  reviewMode?: boolean;
  onApprove?: (id: string) => void;
  onEdit?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onSelectVariant?: (variant: { title: string; text: string; type: string }) => void;
}

// 格式化时间显示
function formatScheduledTime(timeStr: string | undefined | null): string {
  if (!timeStr) return '暂无时间';

  try {
    let date: Date;

    // 🔥 如果只有时间（如 "09:30"），拼接今天的日期
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
      const today = new Date();
      const [hours, minutes] = timeStr.split(':');
      date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes));
    } else {
      // 完整日期时间字符串
      date = new Date(timeStr);
    }

    if (isNaN(date.getTime())) return timeStr; // 如果无法解析，返回原值

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    return timeStr;
  }
}

export function ContentPreviewCard({
  content,
  publishJob,
  reviewMode = true,
  onApprove,
  onEdit,
  onRegenerate,
  onSelectVariant,
}: ContentPreviewCardProps) {
  if (!content) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            ✨ 下一篇内容预览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <div className="text-4xl mb-2">⏳</div>
            <p>内容创作中...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 🔥 后端返回 image_urls (snake_case)，兼容 imageUrls (camelCase)
  const imageUrls = (content as any).image_urls || content.imageUrls || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          ✨ 下一篇内容预览
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2">{content.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-6">{content.content}</p>
        </div>

        {imageUrls && imageUrls.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{imageUrls.length} 张图片</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {imageUrls.slice(0, 4).map((url: string, i: number) => (
                <img
                  key={i}
                  src={url}
                  alt={`预览图 ${i + 1}`}
                  className="w-full h-24 object-cover rounded"
                  onError={(e) => {
                    // 🔥 图片加载失败时显示占位符
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E图片%3C/text%3E%3C/svg%3E';
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {content.hashtags && content.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {content.hashtags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* 🔥 变体选择器 (审核模式下显示) */}
        {reviewMode && content.copyVariants && (
          <VariantSelector
            copyVariants={content.copyVariants}
            goldenQuotes={content.goldenQuotes}
            copyStrategy={content.copyStrategy}
            reviewMode={reviewMode}
            onSelectVariant={onSelectVariant}
          />
        )}

        <div className="flex items-center gap-2 text-sm text-gray-500 pt-2 border-t">
          <Clock className="w-4 h-4" />
          <span>{formatScheduledTime(content.scheduledTime)}</span>
          <Badge variant="outline">{content.type}</Badge>
        </div>

        {/* 🔥 发布状态显示 - 支持两种来源：publishJob（轮询中）和 content.status（持久化状态） */}
        {(publishJob || content.status === 'published') && (
          <div className="mt-3 p-3 rounded-lg bg-gray-50 border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {publishJob?.status === 'pending' && (
                  <>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-yellow-700">⏳ 等待发布</span>
                  </>
                )}
                {publishJob?.status === 'processing' && (
                  <>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-blue-700">🔄 正在发布中...</span>
                  </>
                )}
                {(publishJob?.status === 'completed' || content.status === 'published') && (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-700">✅ 已发布到小红书</span>
                  </>
                )}
                {publishJob?.status === 'failed' && (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium text-red-700">❌ 发布失败</span>
                  </>
                )}
              </div>
              {publishJob?.jobId && (
                <Badge variant="secondary" className="text-xs font-mono">
                  {publishJob.jobId.slice(0, 12)}...
                </Badge>
              )}
            </div>
            {publishJob?.progress !== undefined && publishJob.status === 'processing' && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${publishJob.progress}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-600 mt-1">{publishJob.progress}%</span>
              </div>
            )}
            {publishJob?.error && (
              <div className="mt-2 text-xs text-red-600">
                错误: {publishJob.error}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-4 border-t">
          {onApprove && (
            <Button
              onClick={() => content.id && onApprove(content.id)}
              className="flex-1 bg-green-500 hover:bg-green-600"
              size="sm"
            >
              <Check className="w-4 h-4 mr-1" />
              批准发布
            </Button>
          )}
          {onEdit && (
            <Button
              onClick={() => content.id && onEdit(content.id)}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <Edit className="w-4 h-4 mr-1" />
              修改
            </Button>
          )}
          {onRegenerate && (
            <Button
              onClick={() => content.id && onRegenerate(content.id)}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重新生成
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
