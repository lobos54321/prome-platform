/**
 * XiaohongshuAnalyticsDashboard.tsx
 * 小红书数据分析仪表板组件
 * 
 * 功能：
 * 1. 展示笔记表现数据
 * 2. 数据趋势图表
 * 3. AI 分析建议
 * 4. 内容策略优化
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// ==================== 类型定义 ====================

interface NoteData {
  id: string;
  user_id: string;
  feed_id: string | null;
  title: string;
  title_hash: string | null;
  cover_url: string | null;
  published_url: string | null;
  published_at: string | null;
  status: string;
  created_at: string;
}

interface AnalyticsData {
  id: string;
  feed_id: string | null;
  title_hash: string | null;
  impressions: number;
  views: number;
  click_rate: number;
  likes: number;
  comments: number;
  collects: number;
  engagement_rate: number;
  collected_at: string;
}

interface NoteWithAnalytics extends NoteData {
  latestAnalytics: AnalyticsData | null;
  analyticsHistory: AnalyticsData[];
}

interface AnalysisSummary {
  totalNotes: number;
  totalImpressions: number;
  totalViews: number;
  totalLikes: number;
  totalCollects: number;
  avgClickRate: number;
  avgEngagementRate: number;
  bestPerformer: NoteWithAnalytics | null;
  worstPerformer: NoteWithAnalytics | null;
}

interface AIAnalysis {
  performanceScore: number;
  performanceLevel: 'excellent' | 'good' | 'average' | 'poor';
  insights: string[];
  recommendations: string[];
  contentStrategy: {
    titleSuggestions: string[];
    contentSuggestions: string[];
    publishTimeSuggestions: string[];
  };
}

// ==================== Supabase 配置 ====================

// Note: supabaseClient will be passed as prop to ensure authenticated access

// ==================== 主组件 ====================

interface Props {
  userId: string;
  supabaseClient: any; // Authenticated Supabase client from parent
  onAnalysisComplete?: (analysis: AIAnalysis) => void;
}

export default function XiaohongshuAnalyticsDashboard({ userId, supabaseClient, onAnalysisComplete }: Props) {
  const [notes, setNotes] = useState<NoteWithAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  // ==================== 数据加载 ====================

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 计算时间范围
      let dateFilter = '';
      if (selectedTimeRange === '7d') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        dateFilter = date.toISOString();
      } else if (selectedTimeRange === '30d') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        dateFilter = date.toISOString();
      }

      // 获取笔记列表
      // 使用 created_at 而不是 published_at，因为 published_at 可能为 null
      let notesQuery = supabaseClient
        .from('xhs_published_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        notesQuery = notesQuery.gte('created_at', dateFilter);
      }

      const { data: notesData, error: notesError } = await notesQuery;

      if (notesError) throw notesError;

      // 获取每个笔记的分析数据
      const notesWithAnalytics: NoteWithAnalytics[] = await Promise.all(
        (notesData || []).map(async (note) => {
          // 通过 feed_id 或 title_hash 查询分析数据
          let analyticsQuery = supabaseClient
            .from('xhs_note_analytics')
            .select('*')
            .eq('user_id', userId)
            .order('collected_at', { ascending: false });

          // 优先使用 feed_id，如果没有则使用 title_hash
          if (note.feed_id) {
            analyticsQuery = analyticsQuery.eq('feed_id', note.feed_id);
          } else if (note.title_hash) {
            analyticsQuery = analyticsQuery.eq('title_hash', note.title_hash);
          } else {
            // 无法匹配，返回空
            return {
              ...note,
              latestAnalytics: null,
              analyticsHistory: []
            };
          }

          const { data: analyticsData } = await analyticsQuery;

          return {
            ...note,
            latestAnalytics: analyticsData?.[0] || null,
            analyticsHistory: analyticsData || []
          };
        })
      );

      setNotes(notesWithAnalytics);

      // 计算汇总数据
      const summaryData = calculateSummary(notesWithAnalytics);
      setSummary(summaryData);

    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [userId, selectedTimeRange]);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  // ==================== 数据计算 ====================

  const calculateSummary = (notesData: NoteWithAnalytics[]): AnalysisSummary => {
    const notesWithData = notesData.filter(n => n.latestAnalytics);

    let totalImpressions = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let totalCollects = 0;
    let totalClickRate = 0;
    let totalEngagementRate = 0;
    let bestScore = -1;
    let worstScore = Infinity;
    let bestPerformer: NoteWithAnalytics | null = null;
    let worstPerformer: NoteWithAnalytics | null = null;

    notesWithData.forEach(note => {
      const a = note.latestAnalytics!;
      totalImpressions += a.impressions;
      totalViews += a.views;
      totalLikes += a.likes;
      totalCollects += a.collects;
      totalClickRate += a.click_rate || 0;
      totalEngagementRate += a.engagement_rate || 0;

      // 计算综合得分
      const score = a.likes + a.collects * 2 + a.comments * 3;
      if (score > bestScore) {
        bestScore = score;
        bestPerformer = note;
      }
      if (score < worstScore && score >= 0) {
        worstScore = score;
        worstPerformer = note;
      }
    });

    const count = notesWithData.length || 1;

    return {
      totalNotes: notesData.length,
      totalImpressions,
      totalViews,
      totalLikes,
      totalCollects,
      avgClickRate: totalClickRate / count,
      avgEngagementRate: totalEngagementRate / count,
      bestPerformer,
      worstPerformer
    };
  };

  // ==================== AI 分析 ====================

  const runAIAnalysis = async () => {
    if (!summary || notes.length === 0) return;

    setAnalyzing(true);

    try {
      // 准备分析数据
      const analysisData = {
        summary,
        topNotes: notes.slice(0, 10).map(n => ({
          title: n.title,
          publishedAt: n.published_at,
          metrics: n.latestAnalytics
        })),
        userId
      };

      // 调用后端 AI 分析 API
      const response = await fetch('/api/agent/auto/analyze-content-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisData)
      });

      if (!response.ok) {
        throw new Error('AI 分析请求失败');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setAiAnalysis(result.data);
        onAnalysisComplete?.(result.data);
      } else {
        // 使用本地简单分析作为备选
        const localAnalysis = generateLocalAnalysis(summary, notes);
        setAiAnalysis(localAnalysis);
      }

    } catch (err: any) {
      console.error('AI analysis failed:', err);
      // 使用本地分析作为备选
      const localAnalysis = generateLocalAnalysis(summary, notes);
      setAiAnalysis(localAnalysis);
    } finally {
      setAnalyzing(false);
    }
  };

  // 本地简单分析（备选方案）
  const generateLocalAnalysis = (
    summaryData: AnalysisSummary,
    notesData: NoteWithAnalytics[]
  ): AIAnalysis => {
    const { avgClickRate, avgEngagementRate, totalLikes, totalCollects, totalNotes } = summaryData;

    // 计算评分
    let score = 50; // 基础分
    if (avgClickRate > 5) score += 15;
    else if (avgClickRate > 3) score += 10;
    else if (avgClickRate > 1) score += 5;

    if (avgEngagementRate > 10) score += 20;
    else if (avgEngagementRate > 5) score += 10;
    else if (avgEngagementRate > 2) score += 5;

    const avgLikes = totalLikes / (totalNotes || 1);
    if (avgLikes > 100) score += 15;
    else if (avgLikes > 50) score += 10;
    else if (avgLikes > 10) score += 5;

    // 确定等级
    let level: 'excellent' | 'good' | 'average' | 'poor';
    if (score >= 80) level = 'excellent';
    else if (score >= 60) level = 'good';
    else if (score >= 40) level = 'average';
    else level = 'poor';

    // 生成洞察
    const insights: string[] = [];
    if (avgClickRate < 3) {
      insights.push('封面点击率偏低，建议优化封面图片和标题');
    }
    if (avgEngagementRate < 5) {
      insights.push('互动率有提升空间，可以在内容中增加互动引导');
    }
    if (totalNotes < 5) {
      insights.push('发布数量较少，建议增加发布频率');
    }

    // 生成建议
    const recommendations: string[] = [];
    recommendations.push('建议使用吸引眼球的封面图，突出主题');
    recommendations.push('标题使用数字或疑问句式提高点击率');
    recommendations.push('在内容结尾添加互动引导，如"你觉得呢？"');
    recommendations.push('保持固定的发布频率，建议每天1-2篇');

    return {
      performanceScore: Math.min(100, Math.max(0, score)),
      performanceLevel: level,
      insights,
      recommendations,
      contentStrategy: {
        titleSuggestions: [
          '使用数字开头：5个技巧、3分钟学会',
          '使用疑问句：你知道吗？为什么？',
          '突出价值：必看、干货、实用'
        ],
        contentSuggestions: [
          '开头直接点题，不要绕弯子',
          '使用分段和表情符号增加可读性',
          '结尾添加总结和互动引导'
        ],
        publishTimeSuggestions: [
          '工作日：12:00-13:00、18:00-20:00',
          '周末：10:00-12:00、15:00-17:00',
          '避开凌晨发布'
        ]
      }
    };
  };

  // ==================== 渲染 ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-2 text-gray-600">加载数据中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadData}
          className="mt-2 text-sm text-red-600 underline"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和时间选择器 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">📊 数据分析</h2>
        <div className="flex items-center gap-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
            <option value="all">全部</option>
          </select>
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* 数据概览卡片 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="总笔记"
            value={summary.totalNotes}
            icon="📝"
          />
          <StatCard
            title="总曝光"
            value={formatNumber(summary.totalImpressions)}
            icon="👁️"
          />
          <StatCard
            title="总点赞"
            value={formatNumber(summary.totalLikes)}
            icon="❤️"
          />
          <StatCard
            title="总收藏"
            value={formatNumber(summary.totalCollects)}
            icon="⭐"
          />
          <StatCard
            title="平均点击率"
            value={`${summary.avgClickRate.toFixed(2)}%`}
            icon="📈"
          />
          <StatCard
            title="平均互动率"
            value={`${summary.avgEngagementRate.toFixed(2)}%`}
            icon="💬"
          />
        </div>
      )}

      {/* AI 分析按钮和结果 */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">🤖 AI 智能分析</h3>
          <button
            onClick={runAIAnalysis}
            disabled={analyzing || notes.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {analyzing ? (
              <>
                <span className="animate-spin">⏳</span>
                分析中...
              </>
            ) : (
              <>
                <span>✨</span>
                开始分析
              </>
            )}
          </button>
        </div>

        {aiAnalysis && (
          <div className="space-y-4">
            {/* 评分 */}
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-purple-600">
                {aiAnalysis.performanceScore}
              </div>
              <div>
                <div className={`inline-block px-2 py-1 rounded text-sm font-medium ${aiAnalysis.performanceLevel === 'excellent' ? 'bg-green-100 text-green-800' :
                  aiAnalysis.performanceLevel === 'good' ? 'bg-blue-100 text-blue-800' :
                    aiAnalysis.performanceLevel === 'average' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                  }`}>
                  {aiAnalysis.performanceLevel === 'excellent' ? '优秀' :
                    aiAnalysis.performanceLevel === 'good' ? '良好' :
                      aiAnalysis.performanceLevel === 'average' ? '一般' : '需改进'}
                </div>
                <p className="text-sm text-gray-600 mt-1">综合表现评分</p>
              </div>
            </div>

            {/* 洞察 */}
            {aiAnalysis.insights.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">💡 数据洞察</h4>
                <ul className="space-y-1">
                  {aiAnalysis.insights.map((insight, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 建议 */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">🎯 优化建议</h4>
              <ul className="space-y-1">
                {aiAnalysis.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* 内容策略 */}
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <StrategyCard
                title="标题技巧"
                icon="📌"
                items={aiAnalysis.contentStrategy.titleSuggestions}
              />
              <StrategyCard
                title="内容优化"
                icon="📝"
                items={aiAnalysis.contentStrategy.contentSuggestions}
              />
              <StrategyCard
                title="发布时间"
                icon="⏰"
                items={aiAnalysis.contentStrategy.publishTimeSuggestions}
              />
            </div>
          </div>
        )}
      </div>

      {/* 笔记列表 */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">📋 笔记表现</h3>
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
          {notes.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              暂无数据，请先同步笔记数据
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== 子组件 ====================

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 text-gray-600 text-sm">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="text-2xl font-bold text-gray-800 mt-1">{value}</div>
    </div>
  );
}

function StrategyCard({ title, icon, items }: { title: string; icon: string; items: string[] }) {
  return (
    <div className="bg-white rounded-lg p-3 border">
      <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
        <span>{icon}</span>
        {title}
      </h5>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-600">• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function NoteCard({ note }: { note: NoteWithAnalytics }) {
  const analytics = note.latestAnalytics;

  return (
    <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* 封面图 */}
        {note.cover_url && (
          <img
            src={note.cover_url}
            alt={note.title}
            className="w-16 h-16 rounded object-cover flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h4 className="font-medium text-gray-800 truncate">{note.title}</h4>

          {/* 发布时间 */}
          <p className="text-xs text-gray-500 mt-1">
            {note.published_at ? new Date(note.published_at).toLocaleString('zh-CN') : '未知时间'}
          </p>

          {/* 数据指标 */}
          {analytics ? (
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              <span className="text-gray-600">
                👁️ {formatNumber(analytics.impressions)}
              </span>
              <span className="text-gray-600">
                📖 {formatNumber(analytics.views)}
              </span>
              <span className="text-red-500">
                ❤️ {analytics.likes}
              </span>
              <span className="text-yellow-600">
                ⭐ {analytics.collects}
              </span>
              <span className="text-blue-500">
                💬 {analytics.comments}
              </span>
              <span className="text-green-600">
                📈 {analytics.click_rate?.toFixed(1)}%
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">暂无数据</p>
          )}
        </div>

        {/* 链接 */}
        {note.published_url && (
          <a
            href={note.published_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:text-purple-800 flex-shrink-0"
          >
            🔗
          </a>
        )}
      </div>
    </div>
  );
}

// ==================== 工具函数 ====================

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}
