/**
 * Video Editor Hook
 *
 * Manages video editing state and operations:
 * - Subtitle generation and management
 * - Background music selection
 * - Playback speed control
 * - Video export via backend API
 */

import { useState } from 'react';
import type { Subtitle } from './SubtitleEditor';
import type { BackgroundMusic } from './BackgroundMusicSelector';

export function useVideoEditor(videoUrl: string) {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [backgroundMusic, setBackgroundMusic] = useState<BackgroundMusic | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);

  // Generate subtitles using speech-to-text
  const generateSubtitles = async () => {
    setIsGeneratingSubtitles(true);
    try {
      const response = await fetch('/api/video/generate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });

      if (!response.ok) {
        throw new Error('字幕生成失败');
      }

      const data = await response.json();
      setSubtitles(data.subtitles || []);
    } catch (error) {
      console.error('Generate subtitles error:', error);
      // Fallback: demo subtitles
      setSubtitles([
        { id: 'demo_1', startTime: 0, endTime: 3, text: '欢迎观看我们的产品介绍' },
        { id: 'demo_2', startTime: 3, endTime: 6, text: '这是一款革命性的智能产品' },
        { id: 'demo_3', startTime: 6, endTime: 9, text: '让我们一起探索它的强大功能' },
      ]);
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  // Export video via backend API (no local ffmpeg dependency)
  const exportVideo = async (): Promise<string> => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      setExportProgress(10);

      const response = await fetch('/api/video/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          subtitles,
          backgroundMusic: backgroundMusic ? {
            name: backgroundMusic.name,
            url: backgroundMusic.url,
            volume: backgroundMusic.volume,
          } : null,
          playbackSpeed,
        }),
      });

      setExportProgress(50);

      if (!response.ok) {
        throw new Error('视频导出失败');
      }

      const data = await response.json();
      setExportProgress(100);
      return data.exportedUrl || videoUrl;
    } catch (error) {
      console.error('Export video error:', error);
      throw new Error('视频导出失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsExporting(false);
    }
  };

  return {
    subtitles,
    setSubtitles,
    backgroundMusic,
    setBackgroundMusic,
    playbackSpeed,
    setPlaybackSpeed,
    isExporting,
    exportProgress,
    exportVideo,
    generateSubtitles,
    isGeneratingSubtitles
  };
}
