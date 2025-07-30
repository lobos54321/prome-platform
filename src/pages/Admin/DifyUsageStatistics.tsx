/**
 * Dify Usage Statistics Component for Admin Panel
 * 
 * Displays detailed Dify API usage statistics, costs, and analytics.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Activity,
  Zap,
  RefreshCw,
  Calendar,
  BarChart3
} from 'lucide-react';
import { db } from '@/lib/supabase';
import { toast } from 'sonner';

interface DifyUsageStats {
  totalConversations: number;
  totalTokens: number;
  totalCost: number;
  totalUsers: number;
  averageTokensPerConversation: number;
  costToday: number;
  tokensToday: number;
  conversationsToday: number;
  topUsers: Array<{
    userId: string;
    userName: string;
    tokens: number;
    cost: number;
    conversations: number;
  }>;
  dailyUsage: Array<{
    date: string;
    tokens: number;
    cost: number;
    conversations: number;
  }>;
}

export const DifyUsageStatistics = () => {
  const [stats, setStats] = useState<DifyUsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Get Dify-related token usage from the database
      const tokenUsage = await db.getTokenUsageByModel('dify-native');
      const difyRealUsage = await db.getTokenUsageByModel('dify-real');
      const workflowUsage = await db.getTokenUsageByModel('dify-workflow');
      
      // Combine all Dify usage
      const allDifyUsage = [...tokenUsage, ...difyRealUsage, ...workflowUsage];
      
      if (allDifyUsage.length === 0) {
        setStats({
          totalConversations: 0,
          totalTokens: 0,
          totalCost: 0,
          totalUsers: 0,
          averageTokensPerConversation: 0,
          costToday: 0,
          tokensToday: 0,
          conversationsToday: 0,
          topUsers: [],
          dailyUsage: []
        });
        setLastUpdated(new Date().toISOString());
        return;
      }

      // Calculate statistics
      const totalTokens = allDifyUsage.reduce((sum, usage) => sum + usage.totalTokens, 0);
      const totalCost = allDifyUsage.reduce((sum, usage) => sum + usage.totalCost, 0);
      
      // Get unique conversations and users
      const uniqueConversations = new Set(
        allDifyUsage.map(u => u.conversationId).filter(Boolean)
      ).size;
      const uniqueUsers = new Set(allDifyUsage.map(u => u.userId)).size;

      // Today's stats
      const today = new Date().toISOString().split('T')[0];
      const todayUsage = allDifyUsage.filter(usage => 
        usage.timestamp.startsWith(today)
      );
      
      const tokensToday = todayUsage.reduce((sum, usage) => sum + usage.totalTokens, 0);
      const costToday = todayUsage.reduce((sum, usage) => sum + usage.totalCost, 0);
      const conversationsToday = new Set(
        todayUsage.map(u => u.conversationId).filter(Boolean)
      ).size;

      // Top users (aggregate by user)
      const userStats = new Map();
      allDifyUsage.forEach(usage => {
        const userId = usage.userId;
        if (!userStats.has(userId)) {
          userStats.set(userId, {
            userId,
            userName: `User ${userId.slice(0, 8)}...`,
            tokens: 0,
            cost: 0,
            conversations: new Set()
          });
        }
        const user = userStats.get(userId);
        user.tokens += usage.totalTokens;
        user.cost += usage.totalCost;
        if (usage.conversationId) {
          user.conversations.add(usage.conversationId);
        }
      });

      const topUsers = Array.from(userStats.values())
        .map(user => ({
          ...user,
          conversations: user.conversations.size
        }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 10);

      // Daily usage for the past 7 days
      const dailyUsage = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayUsage = allDifyUsage.filter(usage => 
          usage.timestamp.startsWith(dateStr)
        );
        
        dailyUsage.push({
          date: dateStr,
          tokens: dayUsage.reduce((sum, usage) => sum + usage.totalTokens, 0),
          cost: dayUsage.reduce((sum, usage) => sum + usage.totalCost, 0),
          conversations: new Set(
            dayUsage.map(u => u.conversationId).filter(Boolean)
          ).size
        });
      }

      setStats({
        totalConversations: uniqueConversations,
        totalTokens,
        totalCost,
        totalUsers: uniqueUsers,
        averageTokensPerConversation: uniqueConversations > 0 ? Math.round(totalTokens / uniqueConversations) : 0,
        costToday,
        tokensToday,
        conversationsToday,
        topUsers,
        dailyUsage
      });

      setLastUpdated(new Date().toISOString());
      
    } catch (error) {
      console.error('Failed to load Dify usage statistics:', error);
      toast.error('加载Dify使用统计失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>加载Dify使用统计...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Alert>
            <AlertDescription>
              无法加载Dify使用统计数据
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            Dify使用统计
            <Badge variant="secondary" className="ml-2">
              <Zap className="h-3 w-3 mr-1" />
              原生API
            </Badge>
          </h2>
          <p className="text-gray-600 mt-1">
            Dify原生API的详细使用情况和成本分析
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              更新于: {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
          <Button 
            onClick={loadStats}
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总对话数</p>
                <p className="text-2xl font-bold">{stats.totalConversations.toLocaleString()}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              今日: {stats.conversationsToday}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总Token数</p>
                <p className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              今日: {stats.tokensToday.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总成本</p>
                <p className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              今日: ${stats.costToday.toFixed(4)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">活跃用户</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              平均: {stats.averageTokensPerConversation} tokens/对话
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              7天使用趋势
            </CardTitle>
            <CardDescription>
              过去7天的Token使用量和成本趋势
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.dailyUsage.map((day, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{new Date(day.date).toLocaleDateString()}</div>
                    <div className="text-sm text-gray-500">{day.conversations} 对话</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{day.tokens.toLocaleString()} tokens</div>
                    <div className="text-sm text-gray-500">${day.cost.toFixed(4)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              使用量TOP用户
            </CardTitle>
            <CardDescription>
              Token使用量最高的用户排行
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topUsers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无用户数据</p>
              ) : (
                stats.topUsers.slice(0, 5).map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <div className="font-medium">{user.userName}</div>
                        <div className="text-sm text-gray-500">{user.conversations} 对话</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{user.tokens.toLocaleString()} tokens</div>
                      <div className="text-sm text-gray-500">${user.cost.toFixed(4)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            统计说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">数据来源</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• dify-native: 原生API直接调用</li>
                <li>• dify-real: 实际Dify使用数据</li>
                <li>• dify-workflow: 工作流使用数据</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">计费说明</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 成本基于实际Token使用量</li>
                <li>• 包含输入和输出Token费用</li>
                <li>• 实时汇率转换为积分扣费</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};