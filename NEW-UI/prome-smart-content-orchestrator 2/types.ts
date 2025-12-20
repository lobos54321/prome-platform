
export enum WorkflowMode {
  IMAGE_TEXT = 'IMAGE_TEXT',
  AVATAR_VIDEO = 'AVATAR_VIDEO',
  UGC_VIDEO = 'UGC_VIDEO'
}

export enum NodeStatus {
  COMPLETED = 'completed',
  PROCESSING = 'processing',
  PENDING = 'pending',
  FAILED = 'failed'
}

export interface WorkflowNode {
  id: string;
  title: string;
  agent: string;
  desc: string;
  status: NodeStatus;
  icon: any; // Lucide icon
  // Comment: Removed top-level eta as it is used within the details object in the application
  details: {
    input?: string;
    output?: string;
    strategy?: string;
    goldenQuotes?: string[];
    readabilityScore?: number;
    timeTaken?: string;
    progress?: number;
    currentAction?: string;
    sessionId?: string;
    promptDraft?: string;
    features?: string[];
    audioUrl?: string;
    videoUrl?: string;
    rawJson?: any;
    // Fix: Added missing properties identified by compilation errors in constants.tsx
    usableImages?: number;
    eta?: string;
  };
}

export interface WorkflowConfig {
  [key: string]: WorkflowNode[];
}