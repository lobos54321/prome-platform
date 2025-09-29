import { useState, useCallback, useMemo } from 'react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface PainPointVersion {
  id: string;
  label: string;
  messages: Message[];
  createdAt: Date;
}

export function usePainPointBranches(messages: Message[]) {
  const [versions, setVersions] = useState<PainPointVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [regenerateCount, setRegenerateCount] = useState(0);
  const maxRegenerateCount = 3;

  // Detect pain point messages and create versions
  const painPointVersions = useMemo(() => {
    const painPointMessages = messages.filter(m => 
      m.role === 'assistant' && 
      m.content.includes('"problem":') && 
      m.content.includes('"justification":')
    );
    
    if (painPointMessages.length === 0) return [];

    return painPointMessages.map((msg, index) => ({
      id: `version_${msg.id}`,
      label: `Version ${index + 1}`,
      messages: messages.slice(0, messages.indexOf(msg) + 1),
      createdAt: msg.timestamp
    }));
  }, [messages]);

  const canRegenerate = regenerateCount < maxRegenerateCount;

  const switchVersion = useCallback((versionId: string) => {
    setActiveVersionId(versionId);
  }, []);

  const addNewVersion = useCallback((newMessages: Message[]) => {
    const newVersion: PainPointVersion = {
      id: `version_${Date.now()}`,
      label: `Version ${versions.length + 1}`,
      messages: newMessages,
      createdAt: new Date()
    };
    setVersions(prev => [...prev, newVersion]);
    setActiveVersionId(newVersion.id);
    setRegenerateCount(prev => prev + 1);
  }, [versions.length]);

  const getActiveVersionMessages = useCallback(() => {
    if (!activeVersionId || painPointVersions.length === 0) return messages;
    
    const activeVersion = painPointVersions.find(v => v.id === activeVersionId);
    return activeVersion ? activeVersion.messages : messages;
  }, [activeVersionId, painPointVersions, messages]);

  return {
    versions: painPointVersions,
    activeVersionId: activeVersionId || (painPointVersions[0]?.id || ''),
    regenerateCount,
    maxRegenerateCount,
    canRegenerate,
    switchVersion,
    addNewVersion,
    getActiveVersionMessages
  };
}