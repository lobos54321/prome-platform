import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, FileText } from 'lucide-react';

interface QueueItem {
  id: string;
  title: string;
  scheduledTime: string;
  status: string;
}

interface ReadyQueueCardProps {
  queue: QueueItem[];
  onView?: (id: string) => void;
}

// 格式化时间显示
function formatScheduledTime(timeStr: string | undefined | null): string {
  if (!timeStr) return '暂无时间';

  try {
    const date = new Date(timeStr);
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

export function ReadyQueueCard({ queue, onView }: ReadyQueueCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          📋 待发布队列
          <span className="ml-2 text-sm font-normal text-gray-600">({queue.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            暂无待发布内容
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className="p-3 border rounded-lg hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-sm mb-1">{item.title}</h5>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatScheduledTime(item.scheduledTime)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  {onView && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onView(item.id)}
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
