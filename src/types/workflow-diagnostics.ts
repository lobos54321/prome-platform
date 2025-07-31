export interface WorkflowEvent {
  id: string;
  timestamp: string;
  conversationId: string | null;
  event: 'workflow_started' | 'workflow_finished' | 'node_started' | 'node_finished' | 'message' | 'message_end' | 'error';
  data?: Record<string, unknown>;
  nodeId?: string;
  nodeName?: string;
  executionTime?: number;
  metadata?: {
    iteration?: number;
    isRetry?: boolean;
    parameters?: Record<string, unknown>;
  };
}

export interface NodeExecution {
  nodeId: string;
  nodeName: string;
  executionCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  lastExecuted: string;
  status: 'running' | 'completed' | 'error' | 'stuck';
  errors: string[];
}

export interface WorkflowSession {
  id: string;
  conversationId: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'error' | 'stuck';
  events: WorkflowEvent[];
  nodeExecutions: Map<string, NodeExecution>;
  parameters: Record<string, unknown>;
  messageCount: number;
  detectedIssues: DiagnosticIssue[];
}

export interface DiagnosticIssue {
  id: string;
  type: 'infinite_loop' | 'stuck_node' | 'timeout' | 'parameter_anomaly' | 'memory_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown>;
  timestamp: string;
  nodeId?: string;
  resolved: boolean;
  autoDetected: boolean;
}

export interface ParameterComparison {
  conversationId: string;
  messageIndex: number;
  timestamp: string;
  parameters: Record<string, unknown>;
  changes: ParameterChange[];
  isFirstMessage: boolean;
}

export interface ParameterChange {
  key: string;
  previousValue: unknown;
  currentValue: unknown;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
}

export interface WorkflowDiagnosticsState {
  isEnabled: boolean;
  activeSessions: Map<string, WorkflowSession>;
  eventHistory: WorkflowEvent[];
  parameterHistory: ParameterComparison[];
  detectedIssues: DiagnosticIssue[];
  statistics: {
    totalSessions: number;
    activeSessionsCount: number;
    totalEvents: number;
    issuesDetected: number;
    averageSessionDuration: number;
  };
}

export interface DiagnosticSettings {
  maxHistorySize: number;
  enableAutoDetection: boolean;
  detectionThresholds: {
    maxNodeExecutions: number;
    maxSessionDuration: number; // in milliseconds
    maxEventInterval: number; // in milliseconds
  };
  enableParameterTracking: boolean;
  enableEventLogging: boolean;
  alertOnIssues: boolean;
}

export interface WorkflowDiagnosticsReport {
  generatedAt: string;
  conversationId: string;
  timeRange: {
    start: string;
    end: string;
  };
  summary: {
    totalEvents: number;
    uniqueNodes: number;
    executionTime: number;
    issuesFound: number;
  };
  timeline: WorkflowEvent[];
  nodeAnalysis: NodeExecution[];
  parameterAnalysis: ParameterComparison[];
  issues: DiagnosticIssue[];
  recommendations: string[];
}