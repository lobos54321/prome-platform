import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ContentStrategy } from '@/types/xiaohongshu';
import { Lightbulb, TrendingUp, Hash, Clock } from 'lucide-react';

interface StrategyCardProps {
  strategy: ContentStrategy | null;
  className?: string;
}

export function StrategyCard({ strategy, className = '' }: StrategyCardProps) {
  if (!strategy) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI 内容策略
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">暂无策略数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          AI 内容策略
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 关键主题 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Lightbulb className="h-4 w-4" />
            关键主题
          </div>
          <div className="flex flex-wrap gap-2">
            {strategy.key_themes && strategy.key_themes.length > 0 ? (
              strategy.key_themes.map((theme, index) => (
                <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-700">
                  {theme}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-gray-500">暂无主题</span>
            )}
          </div>
        </div>

        {/* 热门话题 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <TrendingUp className="h-4 w-4" />
            热门话题
          </div>
          <div className="flex flex-wrap gap-2">
            {strategy.trending_topics && strategy.trending_topics.length > 0 ? (
              strategy.trending_topics.map((topic, index) => (
                <Badge key={index} variant="secondary" className="bg-pink-100 text-pink-700">
                  {topic}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-gray-500">暂无话题</span>
            )}
          </div>
        </div>

        {/* 推荐标签 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Hash className="h-4 w-4" />
            推荐标签
          </div>
          <div className="flex flex-wrap gap-2">
            {strategy.hashtags && strategy.hashtags.length > 0 ? (
              strategy.hashtags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-blue-600 border-blue-300">
                  #{tag}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-gray-500">暂无标签</span>
            )}
          </div>
        </div>

        {/* 最佳时间 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Clock className="h-4 w-4" />
            最佳发布时间
          </div>
          <div className="flex flex-wrap gap-2">
            {strategy.optimal_times && strategy.optimal_times.length > 0 ? (
              strategy.optimal_times.map((time, index) => (
                <Badge key={index} variant="secondary" className="bg-green-100 text-green-700">
                  {time}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-gray-500">暂无数据</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
