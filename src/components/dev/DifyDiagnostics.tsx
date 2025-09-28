/**
 * Dify API诊断面板 - 仅在开发环境显示
 * 用于调试Dify API usage数据问题
 */

import { useState, useEffect } from 'react';
import { DifyApiMonitor, DifyApiDiagnostics } from '@/utils/difyApiMonitor';

export function DifyDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DifyApiDiagnostics[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState<string>('');

  useEffect(() => {
    // 定期更新诊断数据
    const interval = setInterval(() => {
      setDiagnostics(DifyApiMonitor.getDiagnosticsHistory());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleGenerateReport = () => {
    const reportText = DifyApiMonitor.generateTroubleshootingReport();
    setReport(reportText);
    setShowReport(true);
  };

  const handleClearHistory = () => {
    DifyApiMonitor.clearHistory();
    setDiagnostics([]);
    setShowReport(false);
  };

  // 只在开发环境显示
  if (!import.meta.env.DEV) {
    return null;
  }

  const recentIssues = diagnostics.filter(d => d.issues.length > 0);

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-gray-900 text-white p-4 rounded-lg shadow-xl z-50 max-h-96 overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">🔍 Dify API 诊断</h3>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateReport}
            className="text-xs bg-blue-600 px-2 py-1 rounded hover:bg-blue-700"
          >
            生成报告
          </button>
          <button
            onClick={handleClearHistory}
            className="text-xs bg-red-600 px-2 py-1 rounded hover:bg-red-700"
          >
            清空
          </button>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span>API调用次数:</span>
          <span className="font-mono">{diagnostics.length}</span>
        </div>
        <div className="flex justify-between">
          <span>发现问题:</span>
          <span className={`font-mono ${recentIssues.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {recentIssues.length}
          </span>
        </div>
      </div>

      {recentIssues.length > 0 && (
        <div className="mt-3 p-2 bg-red-900/50 rounded">
          <div className="text-xs font-semibold text-red-300 mb-1">最近问题:</div>
          {recentIssues.slice(0, 3).map((d, i) => (
            <div key={i} className="text-xs text-red-200 mb-1">
              • {d.issues[0]} ({new Date(d.timestamp).toLocaleTimeString()})
            </div>
          ))}
        </div>
      )}

      {showReport && (
        <div className="mt-3 p-2 bg-gray-800 rounded max-h-40 overflow-auto">
          <div className="text-xs font-semibold mb-2">诊断报告:</div>
          <pre className="text-xs whitespace-pre-wrap text-gray-300">
            {report}
          </pre>
        </div>
      )}

      <div className="mt-2 text-xs text-gray-400">
        在控制台输入 <code className="bg-gray-800 px-1 rounded">window.DifyDebug.getReport()</code> 获取完整报告
      </div>
    </div>
  );
}