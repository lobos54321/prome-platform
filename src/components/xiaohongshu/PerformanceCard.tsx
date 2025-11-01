import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Eye, Heart, MessageCircle } from 'lucide-react';

interface PerformanceData {
  totalPosts?: number;
  totalViews?: number;
  totalLikes?: number;
  totalComments?: number;
  avgEngagementRate?: number;
}

interface PerformanceCardProps {
  data?: PerformanceData | null;
}

export function PerformanceCard({ data }: PerformanceCardProps) {
  if (!data || data.totalPosts === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            📊 运营数据
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <div className="text-4xl mb-2">📈</div>
            <p>等待首次发布后统计数据...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      icon: FileText,
      label: '发布数',
      value: data.totalPosts || 0,
      color: 'text-blue-600',
    },
    {
      icon: Eye,
      label: '总浏览',
      value: data.totalViews || 0,
      color: 'text-green-600',
    },
    {
      icon: Heart,
      label: '总点赞',
      value: data.totalLikes || 0,
      color: 'text-red-600',
    },
    {
      icon: MessageCircle,
      label: '总评论',
      value: data.totalComments || 0,
      color: 'text-purple-600',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          📊 运营数据
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-sm text-gray-600">{stat.label}</span>
              </div>
              <span className="font-semibold">{stat.value.toLocaleString()}</span>
            </div>
          );
        })}
        
        {data.avgEngagementRate !== undefined && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-gray-600">互动率</span>
              </div>
              <span className="font-semibold text-orange-600">
                {(data.avgEngagementRate * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 修复导入
import { FileText } from 'lucide-react';
