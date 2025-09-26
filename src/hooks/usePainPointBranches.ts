import { useState, useEffect, useMemo } from 'react';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: any;
}

export interface PainPointVersion {
  id: string;
  label: string;
  messages: Message[];
  createdAt: Date;
}

export interface UsePainPointBranchesReturn {
  versions: PainPointVersion[];
  activeVersionId: string;
  regenerateCount: number;
  maxRegenerateCount: number;
  canRegenerate: boolean;
  switchVersion: (versionId: string) => void;
  addNewVersion: (painPointMessages: Message[]) => string;
  getActiveVersionMessages: () => Message[];
}

export const usePainPointBranches = (
  allMessages: Message[]
): UsePainPointBranchesReturn => {
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [regenerateCount, setRegenerateCount] = useState<number>(0);
  const maxRegenerateCount = 3;

  // 识别痛点生成消息
  const isPainPointGenerationMessage = (message: Message): boolean => {
    return message.role === 'assistant' && 
           message.content.includes('"problem":') && 
           message.content.includes('"justification":');
  };

  // 将消息按痛点版本分组
  const versions = useMemo(() => {
    const painPointMessages = allMessages.filter(isPainPointGenerationMessage);
    console.log('🔍 [usePainPointBranches] Found pain point messages:', painPointMessages.length, painPointMessages.map(m => ({ id: m.id, preview: m.content.substring(0, 100) })));
    const versions: PainPointVersion[] = [];

    painPointMessages.forEach((painPointMsg, index) => {
      const versionId = `version_${index + 1}`;
      const label = `版本${index + 1}`;
      
      // 找到这个痛点消息的位置
      const painPointIndex = allMessages.findIndex(m => m.id === painPointMsg.id);
      
      // 找到下一个痛点消息的位置（作为当前版本的结束边界）
      const nextPainPointIndex = painPointMessages[index + 1] 
        ? allMessages.findIndex(m => m.id === painPointMessages[index + 1].id)
        : allMessages.length;

      // 提取当前版本的所有消息（从痛点消息到下一个痛点消息之前）
      const versionMessages = allMessages.slice(painPointIndex, nextPainPointIndex);

      versions.push({
        id: versionId,
        label,
        messages: versionMessages,
        createdAt: painPointMsg.timestamp
      });
    });

    return versions;
  }, [allMessages]);

  // 更新regenerate计数
  useEffect(() => {
    setRegenerateCount(Math.max(0, versions.length - 1));
  }, [versions.length]);

  // 设置默认激活版本（最新版本）
  useEffect(() => {
    if (versions.length > 0 && !activeVersionId) {
      setActiveVersionId(versions[versions.length - 1].id);
    }
  }, [versions, activeVersionId]);

  // 切换版本
  const switchVersion = (versionId: string) => {
    setActiveVersionId(versionId);
  };

  // 添加新版本（regenerate时调用）
  const addNewVersion = (painPointMessages: Message[]): string => {
    const newVersionId = `version_${versions.length + 1}`;
    // 新版本会通过allMessages的更新自动在versions中体现
    // 自动切换到新版本
    setActiveVersionId(newVersionId);
    return newVersionId;
  };

  // 获取当前激活版本的消息
  const getActiveVersionMessages = (): Message[] => {
    const activeVersion = versions.find(v => v.id === activeVersionId);
    return activeVersion ? activeVersion.messages : [];
  };

  return {
    versions,
    activeVersionId,
    regenerateCount,
    maxRegenerateCount,
    canRegenerate: regenerateCount < maxRegenerateCount,
    switchVersion,
    addNewVersion,
    getActiveVersionMessages
  };
};