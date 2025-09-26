import React from 'react';
import { RotateCcw } from 'lucide-react';
import { PainPointVersion } from '../../hooks/usePainPointBranches';

interface PainPointTabNavigationProps {
  versions: PainPointVersion[];
  activeVersionId: string;
  regenerateCount: number;
  maxRegenerateCount: number;
  canRegenerate: boolean;
  onVersionSwitch: (versionId: string) => void;
  onRegenerateRequest: () => void;
  isLoading?: boolean;
}

export const PainPointTabNavigation: React.FC<PainPointTabNavigationProps> = ({
  versions,
  activeVersionId,
  regenerateCount,
  maxRegenerateCount,
  canRegenerate,
  onVersionSwitch,
  onRegenerateRequest,
  isLoading = false
}) => {
  if (versions.length === 0) return null;

  return (
    <div className="mb-4 border-b border-gray-200">
      <div className="flex items-center gap-2 pb-2">
        {/* 版本标签 */}
        <div className="flex gap-1">
          {versions.map((version) => (
            <button
              key={version.id}
              onClick={() => onVersionSwitch(version.id)}
              className={`px-3 py-1 text-sm font-medium rounded-t-md transition-all ${
                version.id === activeVersionId
                  ? 'bg-blue-500 text-white border-b-2 border-blue-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {version.label}
            </button>
          ))}
        </div>

        {/* Regenerate按钮 */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">
            ({regenerateCount}/{maxRegenerateCount})
          </span>
          <button
            onClick={onRegenerateRequest}
            disabled={!canRegenerate || isLoading}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-all ${
              canRegenerate && !isLoading
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={
              !canRegenerate 
                ? `已达到最大重试次数 (${maxRegenerateCount})`
                : '重新生成痛点'
            }
          >
            <RotateCcw className="w-3 h-3" />
            {canRegenerate ? 'Regenerate' : 'Max Reached'}
          </button>
        </div>
      </div>
    </div>
  );
};