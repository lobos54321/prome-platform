/**
 * Video Editor Component
 *
 * Provides video editing capabilities:
 * - Subtitle generation and editing
 * - Background music selection
 * - Playback speed adjustment
 * - Video export with all edits applied
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Video,
  Music,
  Subtitles,
  Gauge,
  Download,
  Loader2,
  Play,
  Pause,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { SubtitleEditor } from './SubtitleEditor';
import { BackgroundMusicSelector } from './BackgroundMusicSelector';
import { SpeedController } from './SpeedController';
import { useVideoEditor } from './useVideoEditor';

interface VideoEditorProps {
  videoUrl: string;
  onExportComplete?: (exportedVideoUrl: string) => void;
  onClose?: () => void;
}

export function VideoEditor({ videoUrl, onExportComplete, onClose }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const {
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
  } = useVideoEditor(videoUrl);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExport = async () => {
    try {
      const exportedUrl = await exportVideo();
      onExportComplete?.(exportedUrl);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Find current subtitle
  const currentSubtitle = subtitles.find(
    sub => currentTime >= sub.startTime && currentTime <= sub.endTime
  );

  return (
    <div className="space-y-4">
      {/* Video Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            视频预览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full aspect-video"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setPlaying(false)}
            />
            {/* Subtitle overlay */}
            {currentSubtitle && (
              <div className="absolute bottom-8 left-0 right-0 text-center">
                <span className="bg-black/70 text-white px-4 py-2 rounded text-lg">
                  {currentSubtitle.text}
                </span>
              </div>
            )}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-4 mt-4">
            <Button variant="outline" size="sm" onClick={togglePlay}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={(e) => {
                  const time = parseFloat(e.target.value);
                  setCurrentTime(time);
                  if (videoRef.current) videoRef.current.currentTime = time;
                }}
                className="w-full"
              />
            </div>
            <span className="text-sm text-gray-500">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="text-sm font-medium">{playbackSpeed}x</span>
          </div>
        </CardContent>
      </Card>

      {/* Editing Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="subtitles">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="subtitles" className="flex items-center gap-1">
                <Subtitles className="h-4 w-4" /> 字幕
              </TabsTrigger>
              <TabsTrigger value="music" className="flex items-center gap-1">
                <Music className="h-4 w-4" /> 音乐
              </TabsTrigger>
              <TabsTrigger value="speed" className="flex items-center gap-1">
                <Gauge className="h-4 w-4" /> 语速
              </TabsTrigger>
            </TabsList>

            <TabsContent value="subtitles">
              <SubtitleEditor
                subtitles={subtitles}
                onSubtitlesChange={setSubtitles}
                onGenerateSubtitles={generateSubtitles}
                isGenerating={isGeneratingSubtitles}
                currentTime={currentTime}
                onSeek={(time) => {
                  setCurrentTime(time);
                  if (videoRef.current) videoRef.current.currentTime = time;
                }}
              />
            </TabsContent>

            <TabsContent value="music">
              <BackgroundMusicSelector
                selectedMusic={backgroundMusic}
                onMusicChange={setBackgroundMusic}
              />
            </TabsContent>

            <TabsContent value="speed">
              <SpeedController
                speed={playbackSpeed}
                onSpeedChange={handleSpeedChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            导出视频
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isExporting ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-lg font-medium">正在导出视频...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">{exportProgress}%</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  导出将应用所有编辑（字幕、背景音乐、语速调整）到最终视频
                </AlertDescription>
              </Alert>

              <div className="flex gap-4">
                <Button
                  onClick={handleExport}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  size="lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出视频
                </Button>

                {onClose && (
                  <Button
                    variant="outline"
                    onClick={onClose}
                    size="lg"
                  >
                    取消
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
