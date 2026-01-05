import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Download, Play, Clock, Film, Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface VideoRecord {
    id: string;
    user_id: string;
    task_id: string;
    script: string;
    audio_url: string;
    video_url: string;
    audio_duration: number;
    status: string;
    created_at: string;
}

interface VideoStats {
    totalVideos: number;
    monthlyVideos: number;
    totalDurationSeconds: number;
    totalDurationFormatted: string;
}

const AGENT_API_BASE = import.meta.env.VITE_AGENT_API_BASE || 'https://xiaohongshu-automation-ai.zeabur.app';

export default function VideoHistory() {
    const { user } = useAuth();
    const [videos, setVideos] = useState<VideoRecord[]>([]);
    const [stats, setStats] = useState<VideoStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [playingVideo, setPlayingVideo] = useState<string | null>(null);
    const pageSize = 10;

    const userId = user?.id ? `user_${user.id.replace(/-/g, '')}_prome` : '';

    const fetchVideos = async () => {
        if (!userId) return;

        setLoading(true);
        setError(null);

        try {
            const [historyRes, statsRes] = await Promise.all([
                fetch(`${AGENT_API_BASE}/agent/videos/history?userId=${userId}&limit=${pageSize}&offset=${currentPage * pageSize}`),
                fetch(`${AGENT_API_BASE}/agent/videos/stats?userId=${userId}`)
            ]);

            const historyData = await historyRes.json();
            const statsData = await statsRes.json();

            if (historyData.success) {
                setVideos(historyData.data.videos);
                setTotal(historyData.data.total);
            } else {
                setError(historyData.error || '获取历史记录失败');
            }

            if (statsData.success) {
                setStats(statsData.data);
            }
        } catch (err: any) {
            setError(err.message || '网络错误');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVideos();
    }, [userId, currentPage]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (seconds: number) => {
        if (seconds >= 60) {
            return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
        }
        return `${seconds}秒`;
    };

    const handleDownload = async (url: string, type: 'video' | 'audio') => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${type === 'video' ? '数字人视频' : '语音音频'}_${Date.now()}.${type === 'video' ? 'mp4' : 'mp3'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error('Download failed:', err);
            // Fallback: open in new tab
            window.open(url, '_blank');
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">📹 视频历史记录</h1>
                        <p className="text-gray-400">查看和下载您生成的所有数字人视频</p>
                    </div>
                    <button
                        onClick={fetchVideos}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                    </button>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-xl rounded-2xl p-5 border border-blue-500/30">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-500/30 rounded-xl">
                                    <Film className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-white">{stats.totalVideos}</div>
                                    <div className="text-blue-300 text-sm">总视频数</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-xl rounded-2xl p-5 border border-green-500/30">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-green-500/30 rounded-xl">
                                    <Calendar className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-white">{stats.monthlyVideos}</div>
                                    <div className="text-green-300 text-sm">本月生成</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-xl rounded-2xl p-5 border border-purple-500/30">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-purple-500/30 rounded-xl">
                                    <Clock className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-white">{stats.totalDurationFormatted}</div>
                                    <div className="text-purple-300 text-sm">总时长</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-xl rounded-2xl p-5 border border-orange-500/30">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-orange-500/30 rounded-xl">
                                    <Download className="w-6 h-6 text-orange-400" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-white">永久</div>
                                    <div className="text-orange-300 text-sm">保存期限</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300 text-center">
                        {error}
                    </div>
                )}

                {/* Video List */}
                {!loading && !error && (
                    <div className="space-y-4">
                        {videos.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <Film className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p className="text-xl">暂无视频记录</p>
                                <p className="text-sm mt-2">生成您的第一个数字人视频吧！</p>
                            </div>
                        ) : (
                            videos.map((video) => (
                                <div
                                    key={video.id}
                                    className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden hover:border-purple-500/50 transition"
                                >
                                    <div className="p-5">
                                        <div className="flex flex-col lg:flex-row gap-5">
                                            {/* Video Preview */}
                                            <div className="lg:w-72 flex-shrink-0">
                                                <div className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden">
                                                    {playingVideo === video.id ? (
                                                        <video
                                                            src={video.video_url}
                                                            controls
                                                            autoPlay
                                                            className="w-full h-full object-cover"
                                                            onEnded={() => setPlayingVideo(null)}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-pink-900/50 cursor-pointer group"
                                                            onClick={() => setPlayingVideo(video.id)}
                                                        >
                                                            <div className="p-4 bg-white/20 rounded-full group-hover:bg-white/30 transition">
                                                                <Play className="w-8 h-8 text-white" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${video.status === 'completed'
                                                        ? 'bg-green-500/20 text-green-300'
                                                        : 'bg-yellow-500/20 text-yellow-300'
                                                        }`}>
                                                        {video.status === 'completed' ? '✅ 已完成' : '⏳ 处理中'}
                                                    </span>
                                                    <span className="text-gray-400 text-sm">
                                                        {formatDate(video.created_at)}
                                                    </span>
                                                    {video.audio_duration && (
                                                        <span className="text-purple-400 text-sm flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatDuration(video.audio_duration)}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-gray-300 mb-4 line-clamp-3">
                                                    {video.script || '无脚本'}
                                                </p>

                                                {/* Audio Preview */}
                                                {video.audio_url && (
                                                    <div className="mb-4">
                                                        <div className="text-xs text-gray-500 mb-1">🔊 语音预览</div>
                                                        <audio
                                                            controls
                                                            className="w-full h-10"
                                                            src={video.audio_url}
                                                        />
                                                    </div>
                                                )}

                                                {/* Action Buttons */}
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => handleDownload(video.video_url, 'video')}
                                                        className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        下载视频
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(video.audio_url, 'audio')}
                                                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        下载音频
                                                    </button>
                                                    <button
                                                        onClick={() => window.open(video.video_url, '_blank')}
                                                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                        新窗口播放
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                            disabled={currentPage === 0}
                            className="flex items-center gap-1 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            上一页
                        </button>
                        <span className="text-gray-400">
                            {currentPage + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={currentPage >= totalPages - 1}
                            className="flex items-center gap-1 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition"
                        >
                            下一页
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
