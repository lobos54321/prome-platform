import { useState, useCallback, useRef, useEffect } from 'react';
import {
  WorkflowEvent,
  WorkflowSession,
  NodeExecution,
  DiagnosticIssue,
  ParameterComparison,
  ParameterChange,
  WorkflowDiagnosticsState,
  DiagnosticSettings,
  WorkflowDiagnosticsReport
} from '@/types/workflow-diagnostics';
import { generateUUID } from '@/lib/utils';

const DEFAULT_SETTINGS: DiagnosticSettings = {
  maxHistorySize: 1000,
  enableAutoDetection: true,
  detectionThresholds: {
    maxNodeExecutions: 3,
    maxSessionDuration: 5 * 60 * 1000, // 5 minutes
    maxEventInterval: 30 * 1000, // 30 seconds
  },
  enableParameterTracking: true,
  enableEventLogging: true,
  alertOnIssues: true,
};

const INITIAL_STATE: WorkflowDiagnosticsState = {
  isEnabled: true,
  activeSessions: new Map(),
  eventHistory: [],
  parameterHistory: [],
  detectedIssues: [],
  statistics: {
    totalSessions: 0,
    activeSessionsCount: 0,
    totalEvents: 0,
    issuesDetected: 0,
    averageSessionDuration: 0,
  },
};

export function useWorkflowDiagnostics() {
  const [state, setState] = useState<WorkflowDiagnosticsState>(INITIAL_STATE);
  const [settings, setSettings] = useState<DiagnosticSettings>(DEFAULT_SETTINGS);
  const lastEventTimeRef = useRef<Map<string, number>>(new Map());
  const nodeExecutionCountRef = useRef<Map<string, Map<string, number>>>(new Map());

  // Load persisted data on mount
  useEffect(() => {
    try {
      const persistedState = localStorage.getItem('workflow_diagnostics_state');
      const persistedSettings = localStorage.getItem('workflow_diagnostics_settings');
      
      if (persistedState) {
        const parsed = JSON.parse(persistedState);
        setState(prev => ({
          ...prev,
          ...parsed,
          activeSessions: new Map(parsed.activeSessions || []),
        }));
      }
      
      if (persistedSettings) {
        setSettings(JSON.parse(persistedSettings));
      }
    } catch (error) {
      console.warn('Failed to load persisted workflow diagnostics data:', error);
    }
  }, []);

  // Persist data when state changes
  useEffect(() => {
    if (state.eventHistory.length > 0 || state.detectedIssues.length > 0) {
      try {
        const persistData = {
          ...state,
          activeSessions: Array.from(state.activeSessions.entries()),
        };
        localStorage.setItem('workflow_diagnostics_state', JSON.stringify(persistData));
      } catch (error) {
        console.warn('Failed to persist workflow diagnostics data:', error);
      }
    }
  }, [state]);

  // Persist settings when they change
  useEffect(() => {
    try {
      localStorage.setItem('workflow_diagnostics_settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to persist workflow diagnostics settings:', error);
    }
  }, [settings]);

  const compareParameters = useCallback((
    previous: Record<string, unknown>,
    current: Record<string, unknown>
  ): ParameterChange[] => {
    const changes: ParameterChange[] = [];
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

    for (const key of allKeys) {
      const prevValue = previous[key];
      const currValue = current[key];

      if (!(key in previous)) {
        changes.push({
          key,
          previousValue: undefined,
          currentValue: currValue,
          type: 'added',
        });
      } else if (!(key in current)) {
        changes.push({
          key,
          previousValue: prevValue,
          currentValue: undefined,
          type: 'removed',
        });
      } else if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        changes.push({
          key,
          previousValue: prevValue,
          currentValue: currValue,
          type: 'modified',
        });
      } else {
        changes.push({
          key,
          previousValue: prevValue,
          currentValue: currValue,
          type: 'unchanged',
        });
      }
    }

    return changes;
  }, []);

  const detectIssues = useCallback((
    sessionId: string,
    session: WorkflowSession,
    event: WorkflowEvent
  ): DiagnosticIssue[] => {
    const issues: DiagnosticIssue[] = [];

    if (!settings.enableAutoDetection) {
      return issues;
    }

    // Check for infinite loops
    if (event.nodeId) {
      const nodeExecutions = session.nodeExecutions.get(event.nodeId);
      if (nodeExecutions && nodeExecutions.executionCount > settings.detectionThresholds.maxNodeExecutions) {
        issues.push({
          id: generateUUID(),
          type: 'infinite_loop',
          severity: 'critical',
          message: `Node ${event.nodeId} has executed ${nodeExecutions.executionCount} times, possible infinite loop`,
          details: {
            nodeId: event.nodeId,
            nodeName: nodeExecutions.nodeName,
            executionCount: nodeExecutions.executionCount,
            sessionId,
          },
          timestamp: new Date().toISOString(),
          nodeId: event.nodeId,
          resolved: false,
          autoDetected: true,
        });
      }
    }

    // Check for stuck sessions
    const sessionDuration = Date.now() - new Date(session.startTime).getTime();
    if (sessionDuration > settings.detectionThresholds.maxSessionDuration && session.status === 'active') {
      issues.push({
        id: generateUUID(),
        type: 'timeout',
        severity: 'high',
        message: `Session has been running for ${Math.round(sessionDuration / 1000)}s, possible timeout`,
        details: {
          sessionId,
          duration: sessionDuration,
          startTime: session.startTime,
        },
        timestamp: new Date().toISOString(),
        resolved: false,
        autoDetected: true,
      });
    }

    // Check for stuck nodes
    if (event.event === 'node_started') {
      const lastEventTime = lastEventTimeRef.current.get(`${sessionId}-${event.nodeId}`);
      const currentTime = Date.now();
      
      if (lastEventTime && (currentTime - lastEventTime) > settings.detectionThresholds.maxEventInterval) {
        issues.push({
          id: generateUUID(),
          type: 'stuck_node',
          severity: 'high',
          message: `Node ${event.nodeId} has been running for ${Math.round((currentTime - lastEventTime) / 1000)}s without completion`,
          details: {
            nodeId: event.nodeId,
            sessionId,
            startTime: new Date(lastEventTime).toISOString(),
            duration: currentTime - lastEventTime,
          },
          timestamp: new Date().toISOString(),
          nodeId: event.nodeId,
          resolved: false,
          autoDetected: true,
        });
      }
      
      lastEventTimeRef.current.set(`${sessionId}-${event.nodeId}`, currentTime);
    }

    return issues;
  }, [settings]);

  const recordEvent = useCallback((
    conversationId: string | null,
    event: Omit<WorkflowEvent, 'id' | 'timestamp' | 'conversationId'>
  ) => {
    if (!state.isEnabled || !settings.enableEventLogging) {
      return;
    }

    const fullEvent: WorkflowEvent = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      conversationId,
      ...event,
    };

    setState(prevState => {
      const sessionId = conversationId || `diagnostics-${generateUUID()}`;
      let session = prevState.activeSessions.get(sessionId);

      // Create new session if needed
      if (!session && event.event === 'workflow_started') {
        session = {
          id: sessionId,
          conversationId: conversationId || '',
          startTime: fullEvent.timestamp,
          status: 'active',
          events: [],
          nodeExecutions: new Map(),
          parameters: event.metadata?.parameters || {},
          messageCount: 0,
          detectedIssues: [],
        };
      }

      if (!session) {
        return prevState; // No session to record event
      }

      // Update session
      session.events.push(fullEvent);

      // Update node execution tracking
      if (event.nodeId) {
        const nodeExecution = session.nodeExecutions.get(event.nodeId) || {
          nodeId: event.nodeId,
          nodeName: event.nodeName || event.nodeId,
          executionCount: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          lastExecuted: fullEvent.timestamp,
          status: 'running',
          errors: [],
        };

        if (event.event === 'node_started') {
          nodeExecution.executionCount++;
          nodeExecution.status = 'running';
        } else if (event.event === 'node_finished') {
          nodeExecution.status = 'completed';
          if (event.executionTime) {
            nodeExecution.totalExecutionTime += event.executionTime;
            nodeExecution.averageExecutionTime = nodeExecution.totalExecutionTime / nodeExecution.executionCount;
          }
        } else if (event.event === 'error') {
          nodeExecution.status = 'error';
          if (typeof event.data === 'string') {
            nodeExecution.errors.push(event.data);
          }
        }

        nodeExecution.lastExecuted = fullEvent.timestamp;
        session.nodeExecutions.set(event.nodeId, nodeExecution);
      }

      // Update session status
      if (event.event === 'workflow_finished') {
        session.status = 'completed';
        session.endTime = fullEvent.timestamp;
      } else if (event.event === 'error') {
        session.status = 'error';
        session.endTime = fullEvent.timestamp;
      }

      // Detect issues
      const newIssues = detectIssues(sessionId, session, fullEvent);
      session.detectedIssues.push(...newIssues);

      // Update state
      const newActiveSessions = new Map(prevState.activeSessions);
      newActiveSessions.set(sessionId, session);

      const newEventHistory = [...prevState.eventHistory, fullEvent];
      if (newEventHistory.length > settings.maxHistorySize) {
        newEventHistory.splice(0, newEventHistory.length - settings.maxHistorySize);
      }

      const newDetectedIssues = [...prevState.detectedIssues, ...newIssues];

      return {
        ...prevState,
        activeSessions: newActiveSessions,
        eventHistory: newEventHistory,
        detectedIssues: newDetectedIssues,
        statistics: {
          ...prevState.statistics,
          totalEvents: prevState.statistics.totalEvents + 1,
          activeSessionsCount: Array.from(newActiveSessions.values()).filter(s => s.status === 'active').length,
          issuesDetected: newDetectedIssues.length,
        },
      };
    });
  }, [state.isEnabled, settings, detectIssues]);

  const recordParameters = useCallback((
    conversationId: string,
    parameters: Record<string, unknown>,
    messageIndex: number
  ) => {
    if (!settings.enableParameterTracking) {
      return;
    }

    setState(prevState => {
      const lastParameters = prevState.parameterHistory
        .filter(p => p.conversationId === conversationId)
        .sort((a, b) => b.messageIndex - a.messageIndex)[0];

      const comparison: ParameterComparison = {
        conversationId,
        messageIndex,
        timestamp: new Date().toISOString(),
        parameters,
        changes: lastParameters ? compareParameters(lastParameters.parameters, parameters) : [],
        isFirstMessage: messageIndex === 0,
      };

      const newParameterHistory = [...prevState.parameterHistory, comparison];
      if (newParameterHistory.length > settings.maxHistorySize) {
        newParameterHistory.splice(0, newParameterHistory.length - settings.maxHistorySize);
      }

      return {
        ...prevState,
        parameterHistory: newParameterHistory,
      };
    });
  }, [settings, compareParameters]);

  const clearSession = useCallback((conversationId: string) => {
    setState(prevState => {
      const newActiveSessions = new Map(prevState.activeSessions);
      newActiveSessions.delete(conversationId);

      return {
        ...prevState,
        activeSessions: newActiveSessions,
        statistics: {
          ...prevState.statistics,
          activeSessionsCount: newActiveSessions.size,
        },
      };
    });
  }, []);

  const resolveIssue = useCallback((issueId: string) => {
    setState(prevState => ({
      ...prevState,
      detectedIssues: prevState.detectedIssues.map(issue =>
        issue.id === issueId ? { ...issue, resolved: true } : issue
      ),
    }));
  }, []);

  const generateReport = useCallback((conversationId: string): WorkflowDiagnosticsReport | null => {
    const session = state.activeSessions.get(conversationId);
    if (!session) {
      return null;
    }

    const events = session.events;
    const startTime = session.startTime;
    const endTime = session.endTime || new Date().toISOString();
    const executionTime = new Date(endTime).getTime() - new Date(startTime).getTime();

    const parameterAnalysis = state.parameterHistory.filter(p => p.conversationId === conversationId);
    const issues = session.detectedIssues;

    const recommendations: string[] = [];
    
    // Generate recommendations based on issues
    if (issues.some(i => i.type === 'infinite_loop')) {
      recommendations.push('检查工作流节点配置，确保没有无限循环的逻辑路径');
      recommendations.push('添加退出条件或最大执行次数限制');
    }
    
    if (issues.some(i => i.type === 'stuck_node')) {
      recommendations.push('检查节点的执行逻辑，可能存在阻塞或超时问题');
      recommendations.push('添加节点执行超时机制');
    }
    
    if (parameterAnalysis.length > 1) {
      const significantChanges = parameterAnalysis.flatMap(p => p.changes.filter(c => c.type !== 'unchanged'));
      if (significantChanges.length > 0) {
        recommendations.push('检查参数传递逻辑，确保状态正确传递');
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      conversationId,
      timeRange: { start: startTime, end: endTime },
      summary: {
        totalEvents: events.length,
        uniqueNodes: session.nodeExecutions.size,
        executionTime,
        issuesFound: issues.length,
      },
      timeline: events,
      nodeAnalysis: Array.from(session.nodeExecutions.values()),
      parameterAnalysis,
      issues,
      recommendations,
    };
  }, [state]);

  const exportData = useCallback(() => {
    const exportData = {
      state,
      settings,
      exportedAt: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [state, settings]);

  const clearAllData = useCallback(() => {
    setState(INITIAL_STATE);
    localStorage.removeItem('workflow_diagnostics_state');
    lastEventTimeRef.current.clear();
    nodeExecutionCountRef.current.clear();
  }, []);

  return {
    state,
    settings,
    recordEvent,
    recordParameters,
    clearSession,
    resolveIssue,
    generateReport,
    exportData,
    clearAllData,
    setSettings,
  };
}