import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Image as ImageIcon, Check, Edit, RefreshCw } from 'lucide-react';

interface ContentPreviewCardProps {
  content?: {
    id?: string;
    title: string;
    content: string;
    scheduledTime: string;
    type: string;
    imageUrls?: string[];
    hashtags?: string[];
  } | null;
  onApprove?: (id: string) => void;
  onEdit?: (id: string) => void;
  onRegenerate?: (id: string) => void;
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

export function ContentPreviewCard({ content, onApprove, onEdit, onRegenerate }: ContentPreviewCardProps) {
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

        <div className="flex items-center gap-2 text-sm text-gray-500 pt-2 border-t">
          <Clock className="w-4 h-4" />
          <span>{formatScheduledTime(content.scheduledTime)}</span>
          <Badge variant="outline">{content.type}</Badge>
        </div>

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
