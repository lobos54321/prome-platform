
import React, { useState, useEffect, useRef } from 'react';
import { 
  WorkflowMode, 
  NodeStatus, 
  WorkflowNode 
} from './types';
import { WORKFLOW_CONFIGS } from './constants';
import { StatusIcon } from './components/StatusIcon';
import { LogDetail } from './components/LogDetail';
import { 
  ChevronRight, 
  Cpu, 
  Image as ImageIcon,
  User as UserIcon,
  Video as VideoIcon,
  Play,
  Pause,
  RefreshCw,
  Terminal,
  Activity,
  Zap
} from 'lucide-react';

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<WorkflowMode>(WorkflowMode.IMAGE_TEXT);
  const [workflowState, setWorkflowState] = useState<Record<WorkflowMode, WorkflowNode[]>>(WORKFLOW_CONFIGS);
  const [activeNodeId, setActiveNodeId] = useState<string>(WORKFLOW_CONFIGS[WorkflowMode.IMAGE_TEXT][0].id);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentNodes = workflowState[activeMode];
  const activeNode = currentNodes.find(n => n.id === activeNodeId) || currentNodes[0];

  useEffect(() => {
    if (!isAutoRunning) return;

    timerRef.current = setInterval(() => {
      setWorkflowState(prev => {
        const nodes = [...prev[activeMode]];
        const currentIndex = nodes.findIndex(n => n.status === NodeStatus.PROCESSING || n.status === NodeStatus.PENDING);
        
        if (currentIndex === -1) {
          setIsAutoRunning(false);
          return prev;
        }

        const currentNode = { ...nodes[currentIndex] };

        if (currentNode.status === NodeStatus.PENDING) {
          currentNode.status = NodeStatus.PROCESSING;
          currentNode.details = { ...currentNode.details, progress: 0 };
          nodes[currentIndex] = currentNode;
          setActiveNodeId(currentNode.id);
          return { ...prev, [activeMode]: nodes };
        }

        if (currentNode.status === NodeStatus.PROCESSING) {
          const currentProgress = currentNode.details.progress || 0;
          if (currentProgress < 100) {
            currentNode.details.progress = Math.min(currentProgress + Math.floor(Math.random() * 25) + 10, 100);
            nodes[currentIndex] = currentNode;
            return { ...prev, [activeMode]: nodes };
          } else {
            currentNode.status = NodeStatus.COMPLETED;
            nodes[currentIndex] = currentNode;
            
            if (currentIndex + 1 < nodes.length) {
              const nextNode = { ...nodes[currentIndex + 1] };
              nextNode.status = NodeStatus.PROCESSING;
              nextNode.details = { ...nextNode.details, progress: 0 };
              nodes[currentIndex + 1] = nextNode;
              setActiveNodeId(nextNode.id);
            } else {
              setIsAutoRunning(false);
            }
            return { ...prev, [activeMode]: nodes };
          }
        }
        return prev;
      });
    }, 600); // 稍微加快速度，增加跳动感

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAutoRunning, activeMode]);

  const handleReset = () => {
    setWorkflowState(JSON.parse(JSON.stringify(WORKFLOW_CONFIGS)));
    setActiveNodeId(WORKFLOW_CONFIGS[activeMode][0].id);
    setIsAutoRunning(false);
  };

  const getModeTheme = (mode: WorkflowMode) => {
    switch(mode) {
      case WorkflowMode.IMAGE_TEXT: return { color: 'text-blue-600', bg: 'bg-blue-600', icon: ImageIcon, label: '图文种草' };
      case WorkflowMode.AVATAR_VIDEO: return { color: 'text-indigo-600', bg: 'bg-indigo-600', icon: UserIcon, label: '数字人讲解' };
      case WorkflowMode.UGC_VIDEO: return { color: 'text-violet-600', bg: 'bg-violet-600', icon: VideoIcon, label: '真人UGC' };
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 overflow-hidden font-sans">
      
      {/* 1. 最左侧：模式轨道 (Pipeline Rail) - 极简圆圈 (通透风格) */}
      <aside className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-8 space-y-10 z-30 shadow-sm">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-4 transition-transform hover:scale-105 cursor-pointer">
          <Zap size={24} fill="white" />
        </div>
        
        <div className="flex-1 flex flex-col space-y-8">
          {Object.values(WorkflowMode).map(mode => {
            const theme = getModeTheme(mode);
            const isActive = activeMode === mode;
            const isProcessing = workflowState[mode].some(n => n.status === NodeStatus.PROCESSING);

            return (
              <div key={mode} className="relative group flex flex-col items-center">
                <button
                  onClick={() => { setActiveMode(mode); setActiveNodeId(workflowState[mode].find(n => n.status !== NodeStatus.COMPLETED)?.id || workflowState[mode][0].id); }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                    isActive 
                      ? `border-blue-200 shadow-md scale-110 bg-white` 
                      : 'border-transparent bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <theme.icon size={22} className={isActive ? theme.color : 'text-slate-400'} />
                  {isProcessing && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border-2 border-white"></span>
                    </span>
                  )}
                </button>
                <div className="absolute left-16 px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {theme.label}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={handleReset} className="p-3 rounded-xl text-slate-400 hover:bg-slate-50 transition-colors">
          <RefreshCw size={20} />
        </button>
      </aside>

      {/* 2. 中间：任务序列 (Task Sequence) - 专注完成度 */}
      <section className="w-[400px] bg-white border-r border-slate-100 flex flex-col shadow-sm">
        <header className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-1">Workflow Engine</h2>
            <span className={`text-xl font-extrabold tracking-tight ${getModeTheme(activeMode).color}`}>
              {getModeTheme(activeMode).label}
            </span>
          </div>
          <button 
            onClick={() => setIsAutoRunning(!isAutoRunning)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${
              isAutoRunning ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {isAutoRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative scrollbar-hide">
          {/* Connector Line */}
          <div className="absolute left-[38px] top-12 bottom-12 w-[2px] bg-slate-50 z-0"></div>

          {currentNodes.map((node) => {
            const isSelected = activeNodeId === node.id;
            const isDone = node.status === NodeStatus.COMPLETED;
            const isWorking = node.status === NodeStatus.PROCESSING;

            return (
              <div 
                key={node.id}
                onClick={() => setActiveNodeId(node.id)}
                className={`node-transition group relative z-10 cursor-pointer flex items-center gap-5 p-5 rounded-3xl border ${
                  isSelected 
                    ? 'bg-white border-blue-100 shadow-xl shadow-blue-900/5 ring-1 ring-blue-500/5' 
                    : 'bg-white border-slate-50 hover:border-slate-100 hover:shadow-sm'
                }`}
              >
                {/* Node Orb */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-500 ${
                  isDone ? 'bg-emerald-50 border-emerald-100 text-emerald-500' :
                  isWorking ? 'bg-blue-50 border-blue-100 text-blue-500 shadow-inner' :
                  'bg-slate-50 border-slate-100 text-slate-300'
                }`}>
                  <StatusIcon status={node.status} size={22} />
                </div>

                {/* Info & Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-bold truncate ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                      {node.title}
                    </h3>
                    {isWorking && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{node.details.progress}%</span>
                    )}
                  </div>
                  
                  {isWorking ? (
                    <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500" 
                        style={{ width: `${node.details.progress}%` }}
                      />
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                      <Cpu size={10} /> {node.agent}
                    </p>
                  )}
                </div>

                <div className={`transition-all duration-300 ${isSelected ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`}>
                  <ChevronRight size={18} className="text-blue-400" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. 右侧：终端监控 (Telemetry Stream) - Agent 日志 (浅色设计) */}
      <main className="flex-1 flex flex-col bg-slate-50/30">
        <header className="h-16 px-8 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
               <Terminal size={18} />
            </div>
            <h1 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Telemetry Monitoring</h1>
            <div className="h-1 w-1 rounded-full bg-slate-300"></div>
            <span className="text-[10px] font-mono text-slate-400">NODE_REF: {activeNode.id}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-bold text-slate-600">CONNECTED</span>
            </div>
            <div className="h-4 w-px bg-slate-100"></div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <Activity size={12} className="text-blue-500" />
              <span>SYNC_LATENCY: 12ms</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-8">
          <div className="h-full bg-white rounded-[2rem] border border-slate-100 shadow-2xl shadow-blue-900/5 overflow-hidden flex flex-col">
            <LogDetail node={activeNode} />
          </div>
        </div>
      </main>

      {/* Footer / Status Bar (通透风格) */}
      <footer className="fixed bottom-0 right-0 left-20 h-8 bg-white/50 backdrop-blur-sm border-t border-slate-100 px-6 flex items-center justify-between z-40 pointer-events-none">
        <div className="flex items-center gap-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          <span>PROME Orchestrator v2.5.1</span>
          <span className="flex items-center gap-1"><Activity size={10}/> Load: Low</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[9px] font-mono text-slate-300">© 2025 PROME.LIVE</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
