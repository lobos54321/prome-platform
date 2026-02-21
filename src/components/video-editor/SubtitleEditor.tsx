/**
 * Subtitle Editor Component
 *
 * Allows users to:
 * - Auto-generate subtitles from video audio
 * - Manually add/edit/delete subtitles
 * - Adjust subtitle timing
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Trash2,
  Wand2,
  Loader2,
  AlertCircle
} from 'lucide-react';

export interface Subtitle {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface SubtitleEditorProps {
  subtitles: Subtitle[];
  onSubtitlesChange: (subtitles: Subtitle[]) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onGenerateSubtitles: () => Promise<void>;
  isGenerating: boolean;
}

export function SubtitleEditor({
  subtitles,
  onSubtitlesChange,
  currentTime,
  duration,
  onSeek,
  onGenerateSubtitles,
  isGenerating
}: SubtitleEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add new subtitle
  const handleAddSubtitle = () => {
    const newSubtitle: Subtitle = {
      id: `sub_${Date.now()}`,
      startTime: currentTime,
      endTime: Math.min(currentTime + 3, duration),
      text: '新字幕'
    };
    onSubtitlesChange([...subtitles, newSubtitle].sort((a, b) => a.startTime - b.startTime));
  };

  // Update subtitle
  const handleUpdateSubtitle = (id: string, updates: Partial<Subtitle>) => {
    onSubtitlesChange(
      subtitles.map(sub => sub.id === id ? { ...sub, ...updates } : sub)
    );
  };

  // Delete subtitle
  const handleDeleteSubtitle = (id: string) => {
    onSubtitlesChange(subtitles.filter(sub => sub.id !== id));
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Auto-generate button */}
      <div className="flex gap-4">
        <Button
          onClick={onGenerateSubtitles}
          disabled={isGenerating}
          className="flex-1"
          variant="outline"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              AI 自动生成字幕
            </>
          )}
        </Button>

        <Button onClick={handleAddSubtitle} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          手动添加
        </Button>
      </div>

      {/* Subtitle list */}
      {subtitles.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            暂无字幕。点击"AI 自动生成字幕"或"手动添加"来创建字幕。
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {subtitles.map((subtitle) => (
            <div
              key={subtitle.id}
              className={`p-4 border rounded-lg transition-colors ${
                currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white border-gray-200'
              }`}
            >
              {editingId === subtitle.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">开始时间 (秒)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={subtitle.startTime}
                        onChange={(e) =>
                          handleUpdateSubtitle(subtitle.id, {
                            startTime: parseFloat(e.target.value)
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">结束时间 (秒)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={subtitle.endTime}
                        onChange={(e) =>
                          handleUpdateSubtitle(subtitle.id, {
                            endTime: parseFloat(e.target.value)
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">字幕内容</Label>
                    <Textarea
                      value={subtitle.text}
                      onChange={(e) =>
                        handleUpdateSubtitle(subtitle.id, { text: e.target.value })
                      }
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      完成
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <button
                        onClick={() => onSeek(subtitle.startTime)}
                        className="hover:text-blue-600 font-mono"
                      >
                        {formatTime(subtitle.startTime)}
                      </button>
                      <span>→</span>
                      <button
                        onClick={() => onSeek(subtitle.endTime)}
                        className="hover:text-blue-600 font-mono"
                      >
                        {formatTime(subtitle.endTime)}
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(subtitle.id)}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSubtitle(subtitle.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm">{subtitle.text}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
