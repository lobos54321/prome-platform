import React from 'react';

interface PainPointVersion {
  id: string;
  label: string;
  messages: any[];
  createdAt: Date;
}

interface PainPointTabNavigationProps {
  versions: PainPointVersion[];
  activeVersionId: string;
  onVersionSwitch: (versionId: string) => void;
  canRegenerate: boolean;
  regenerateCount: number;
  maxRegenerateCount: number;
}

export function PainPointTabNavigation({
  versions,
  activeVersionId,
  onVersionSwitch,
  canRegenerate,
  regenerateCount,
  maxRegenerateCount
}: PainPointTabNavigationProps) {
  if (versions.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-600">Pain Point Versions:</span>
      <div className="flex gap-1">
        {versions.map((version) => (
          <button
            key={version.id}
            onClick={() => onVersionSwitch(version.id)}
            className={`px-3 py-1 text-xs rounded transition-all ${
              version.id === activeVersionId
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {version.label}
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-500 ml-auto">
        {regenerateCount}/{maxRegenerateCount} regenerations
      </div>
    </div>
  );
}