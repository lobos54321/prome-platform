/**
 * Speed Controller Component
 *
 * Allows users to adjust video playback speed
 */

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gauge, AlertCircle } from 'lucide-react';

interface SpeedControllerProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const SPEED_PRESETS = [
  { value: 0.5, label: '0.5x 慢速' },
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1.0x 正常' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2.0, label: '2.0x 快速' }
];

export function SpeedController({ speed, onSpeedChange }: SpeedControllerProps) {
  return (
    <div className="space-y-6">
      {/* Current speed display */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 rounded-lg">
          <Gauge className="h-5 w-5 text-blue-600" />
          <span className="text-2xl font-bold text-blue-600">
            {speed.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Speed slider */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          语速调节
        </Label>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 min-w-[40px]">0.5x</span>
          <Slider
            value={[speed]}
            onValueChange={(value) => onSpeedChange(value[0])}
            min={0.5}
            max={2.0}
            step={0.05}
            className="flex-1"
          />
          <span className="text-sm text-gray-600 min-w-[40px]">2.0x</span>
        </div>
      </div>

      {/* Speed presets */}
      <div className="space-y-3">
        <Label>快速选择</Label>
        <div className="grid grid-cols-3 gap-2">
          {SPEED_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant={speed === preset.value ? 'default' : 'outline'}
              onClick={() => onSpeedChange(preset.value)}
              className="w-full"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Info alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2 text-sm">
            <p><strong>语速调整说明：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>0.5x - 0.9x: 适合教学、详细讲解类视频</li>
              <li>1.0x: 正常语速，最自然的效果</li>
              <li>1.1x - 1.5x: 适合快节奏营销视频</li>
              <li>1.5x - 2.0x: 适合快速浏览、信息密集型内容</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              注意：语速调整会同时影响视频和音频的播放速度
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
