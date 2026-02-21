/**
 * Background Music Selector Component
 *
 * Allows users to:
 * - Select from pre-defined music library
 * - Upload custom music
 * - Adjust volume
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Music,
  Upload,
  Volume2,
  Play,
  Pause,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export interface BackgroundMusic {
  id: string;
  name: string;
  url: string;
  volume: number;
}

interface BackgroundMusicSelectorProps {
  selectedMusic: BackgroundMusic | null;
  onMusicChange: (music: BackgroundMusic | null) => void;
}

// Pre-defined music library
const MUSIC_LIBRARY = [
  {
    id: 'upbeat-1',
    name: '欢快节奏',
    category: '活力',
    url: '/music/upbeat-1.mp3'
  },
  {
    id: 'calm-1',
    name: '轻柔舒缓',
    category: '放松',
    url: '/music/calm-1.mp3'
  },
  {
    id: 'corporate-1',
    name: '商务专业',
    category: '商务',
    url: '/music/corporate-1.mp3'
  },
  {
    id: 'inspiring-1',
    name: '励志激昂',
    category: '激励',
    url: '/music/inspiring-1.mp3'
  }
];

export function BackgroundMusicSelector({
  selectedMusic,
  onMusicChange
}: BackgroundMusicSelectorProps) {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Handle music selection
  const handleSelectMusic = (music: typeof MUSIC_LIBRARY[0]) => {
    onMusicChange({
      id: music.id,
      name: music.name,
      url: music.url,
      volume: 0.3 // Default 30% volume
    });
  };

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    if (selectedMusic) {
      onMusicChange({
        ...selectedMusic,
        volume: value[0]
      });
    }
  };

  // Handle music preview
  const handlePreview = (musicUrl: string, musicId: string) => {
    if (previewingId === musicId) {
      // Stop preview
      audioElement?.pause();
      setPreviewingId(null);
      setAudioElement(null);
    } else {
      // Start preview
      audioElement?.pause();
      const audio = new Audio(musicUrl);
      audio.volume = 0.3;
      audio.play();
      setAudioElement(audio);
      setPreviewingId(musicId);

      audio.onended = () => {
        setPreviewingId(null);
        setAudioElement(null);
      };
    }
  };

  // Remove music
  const handleRemoveMusic = () => {
    audioElement?.pause();
    setPreviewingId(null);
    setAudioElement(null);
    onMusicChange(null);
  };

  return (
    <div className="space-y-6">
      {/* Selected music info */}
      {selectedMusic && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>已选择: {selectedMusic.name}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRemoveMusic}
            >
              移除
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Volume control */}
      {selectedMusic && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            音量调节
          </Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[selectedMusic.volume]}
              onValueChange={handleVolumeChange}
              min={0}
              max={1}
              step={0.01}
              className="flex-1"
            />
            <span className="text-sm text-gray-600 min-w-[50px]">
              {Math.round(selectedMusic.volume * 100)}%
            </span>
          </div>
          <p className="text-xs text-gray-500">
            建议将背景音乐音量设置在 20-40% 之间，避免盖过人声
          </p>
        </div>
      )}

      {/* Music library */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Music className="h-4 w-4" />
          音乐库
        </Label>

        <div className="grid grid-cols-2 gap-3">
          {MUSIC_LIBRARY.map((music) => (
            <Card
              key={music.id}
              className={`cursor-pointer transition-all ${
                selectedMusic?.id === music.id
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{music.name}</h4>
                      <p className="text-xs text-gray-500">{music.category}</p>
                    </div>
                    {selectedMusic?.id === music.id && (
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSelectMusic(music)}
                    >
                      选择
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePreview(music.url, music.id)}
                    >
                      {previewingId === music.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Upload custom music */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          上传自定义音乐
        </Label>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            自定义音乐上传功能即将推出
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
