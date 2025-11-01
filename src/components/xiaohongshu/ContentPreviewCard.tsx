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

        {content.imageUrls && content.imageUrls.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{content.imageUrls.length} 张图片</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {content.imageUrls.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`预览图 ${i + 1}`}
                  className="w-full h-24 object-cover rounded"
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
          <span>{content.scheduledTime}</span>
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
