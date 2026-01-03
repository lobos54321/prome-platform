'use client';

import React from 'react';
import { WorkflowNode, NodeStatus } from '@/types/workflow';
import {
    Terminal, Copy, Info, BarChart3, Clock, UserCheck,
    Layout, FileText, ChevronRight, Zap
} from 'lucide-react';

interface LogDetailProps {
    node: WorkflowNode;
}

export const LogDetail: React.FC<LogDetailProps> = ({ node }) => {
    // 动态获取图标组件
    const NodeIcon = node.icon || FileText;

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Node Header Info */}
            <div className="px-10 py-8 bg-white border-b border-slate-50">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-8">
                        <div className="p-5 rounded-[1.5rem] bg-slate-50 border border-slate-100 text-blue-600 shadow-inner">
                            <NodeIcon size={32} strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{node.title}</h2>
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${node.status === NodeStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600' :
                                    node.status === NodeStatus.PROCESSING ? 'bg-blue-50 text-blue-600 animate-pulse' :
                                        node.status === NodeStatus.FAILED ? 'bg-rose-50 text-rose-600' :
                                            'bg-slate-50 text-slate-400'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${node.status === NodeStatus.COMPLETED ? 'bg-emerald-500' :
                                        node.status === NodeStatus.PROCESSING ? 'bg-blue-500' :
                                            node.status === NodeStatus.FAILED ? 'bg-rose-500' :
                                                'bg-slate-300'
                                        }`}></span>
                                    {node.status === NodeStatus.COMPLETED ? '已完成' :
                                        node.status === NodeStatus.PROCESSING ? '处理中' :
                                            node.status === NodeStatus.FAILED ? '失败' : '等待中'}
                                </div>
                            </div>
                            <div className="flex items-center gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                <span className="flex items-center gap-2">
                                    <Terminal size={14} className="text-blue-500" />
                                    执行器: <span className="text-slate-600">{node.agent}</span>
                                </span>
                                {node.details.timeTaken && (
                                    <span className="flex items-center gap-2">
                                        <Clock size={14} />
                                        耗时: <span className="text-slate-600">{node.details.timeTaken}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                            <Copy size={18} />
                        </button>
                        <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                            <Info size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 bg-white">

                {node.status === NodeStatus.PENDING ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-6">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
                            <Clock size={40} className="text-slate-200" />
                        </div>
                        <p className="font-bold text-sm tracking-[0.3em] uppercase opacity-50">等待执行...</p>
                    </div>
                ) : (
                    <>
                        {/* Quick Analytics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {node.details.strategy && (
                                <div className="p-6 rounded-3xl bg-blue-50/30 border border-blue-100/50 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center gap-3 text-blue-600 mb-3">
                                        <div className="p-2 bg-white rounded-xl shadow-sm"><BarChart3 size={18} /></div>
                                        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]">策略分析</span>
                                    </div>
                                    <p className="text-slate-700 font-bold text-lg leading-tight">{node.details.strategy}</p>
                                </div>
                            )}
                            {node.details.readabilityScore !== undefined && (
                                <div className="p-6 rounded-3xl bg-emerald-50/30 border border-emerald-100/50 hover:shadow-lg transition-shadow">
                                    <div className="flex items-center gap-3 text-emerald-600 mb-3">
                                        <div className="p-2 bg-white rounded-xl shadow-sm"><UserCheck size={18} /></div>
                                        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]">质量评分</span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black text-slate-800">{node.details.readabilityScore}</span>
                                        <span className="text-slate-400 font-bold text-sm">/ 100</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Data Section */}
                        {node.details.input && (
                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <Layout size={14} className="text-blue-500" />
                                    输入数据
                                </label>
                                <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] font-mono text-xs leading-relaxed text-slate-500 shadow-inner relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none uppercase text-[40px] font-black">Input</div>
                                    {node.details.input}
                                </div>
                            </div>
                        )}

                        {/* Response Section */}
                        {node.details.output && (
                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <FileText size={14} className="text-emerald-500" />
                                    执行结果
                                </label>
                                <div className="p-8 bg-white border border-slate-100 rounded-[2rem] text-slate-700 text-base whitespace-pre-wrap leading-relaxed shadow-xl shadow-slate-200/40 relative">
                                    <div className="absolute -top-3 -left-3 p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200">
                                        <Zap size={20} fill="white" />
                                    </div>
                                    {(() => {
                                        const output = node.details.output;
                                        if (typeof output !== 'object' || output === null) return output;

                                        // 1. 详细发布计划 (detail-plan)
                                        if (node.id === 'detail-plan' && (output.today_target || output.target || output.taskCount)) {
                                            const targetText = output.today_target || output.target || '内容创作任务';
                                            return (
                                                <div className="space-y-6">
                                                    <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] text-white shadow-xl">
                                                        <div className="text-[10px] uppercase font-black opacity-60 tracking-[0.2em] mb-2">📝 详细计划</div>
                                                        <div className="text-xl font-black mb-2">{targetText}</div>
                                                        <div className="flex items-center gap-4 text-sm opacity-80">
                                                            <span>📋 任务数: {output.taskCount || output.tasksCount || 1}</span>
                                                        </div>
                                                    </div>

                                                    {/* 如果存在任务汇总，显示清单 */}
                                                    {Array.isArray(output.taskSummaries) && (
                                                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                            <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-3">策划任务清单</label>
                                                            {output.taskSummaries.map((task: any, i: number) => (
                                                                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 transition-all group">
                                                                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                                        {i + 1}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-extrabold text-slate-700 truncate">{task.title}</div>
                                                                        <div className="flex items-center gap-3 mt-1">
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">{task.type || '视频'}</span>
                                                                            {task.scheduledTime && (
                                                                                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                                                                    <Clock size={10} />
                                                                                    {new Date(task.scheduledTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                                        <span className="text-sm font-bold text-slate-600">计划已生成，准备进入脚本创作阶段</span>
                                                    </div>
                                                </div>
                                            );
                                        }


                                        // 2. 图片智能适配 (image-adapt)
                                        if (node.id === 'image-adapt' && (output.layout || output.arrangement)) {
                                            return (
                                                <div className="space-y-8">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                                            <label className="text-[10px] uppercase font-black text-amber-600 tracking-wider mb-1 block">推荐布局</label>
                                                            <div className="text-sm font-bold text-slate-800">{output.layout}</div>
                                                        </div>
                                                        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                            <label className="text-[10px] uppercase font-black text-indigo-600 tracking-wider mb-1 block">色彩/光效</label>
                                                            <div className="text-sm font-bold text-slate-800">{output.lighting}</div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block px-1">视觉编排路线</label>
                                                        {Array.isArray(output.arrangement) && output.arrangement.map((step: string, i: number) => (
                                                            <div key={i} className="flex items-start gap-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100 group hover:border-blue-200 transition-colors">
                                                                <span className="w-6 h-6 flex-shrink-0 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:text-blue-500">{i + 1}</span>
                                                                <span className="text-sm font-bold text-slate-600 leading-snug">{step}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // 3. 策略分析 (copy-analyze)
                                        if (node.id === 'copy-analyze' && output.strategy) {
                                            return (
                                                <div className="space-y-8">
                                                    <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] text-white shadow-xl">
                                                        <div className="text-[10px] uppercase font-black opacity-60 tracking-[0.2em] mb-2">深度策略</div>
                                                        <div className="text-xl font-black mb-4">{output.strategy}</div>
                                                        <div className="text-sm opacity-90 leading-relaxed font-medium">{output.insight}</div>
                                                    </div>
                                                    {output.key_themes && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {output.key_themes.map((theme: string, i: number) => (
                                                                <span key={theme} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-xs font-black">#{theme}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // 4. 数字人脚本生成 (script-gen)
                                        if (node.id === 'script-gen') {
                                            return (
                                                <div className="space-y-6">
                                                    <div className="p-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-[2rem] text-white shadow-xl">
                                                        <div className="text-[10px] uppercase font-black opacity-60 tracking-[0.2em] mb-2">📜 口播脚本</div>
                                                        <div className="text-xl font-black mb-2">{output.title || '数字人口播脚本'}</div>
                                                        <div className="flex items-center gap-4 text-sm opacity-80">
                                                            <span>🎬 时长: {output.duration || '2-5分钟'}</span>
                                                            <span>📝 脚本数: {output.scriptCount || 1}</span>
                                                        </div>
                                                    </div>
                                                    {output.script && (
                                                        <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner">
                                                            <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-3">脚本详情</div>
                                                            <div className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap italic">
                                                                "{output.script}"
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                                                        <span className="text-sm font-bold text-slate-600">脚本已生成，准备进入语音合成阶段</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // 5. 语音克隆 (voice-clone)
                                        if (node.id === 'voice-clone') {
                                            return (
                                                <div className="space-y-6">
                                                    <div className="p-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2rem] text-white shadow-xl">
                                                        <div className="text-[10px] uppercase font-black opacity-60 tracking-[0.2em] mb-2">🎤 语音克隆</div>
                                                        <div className="text-xl font-black mb-2">高保真语音合成完成</div>
                                                        <div className="flex items-center gap-2 text-sm opacity-80">
                                                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                                            状态: {output.status === 'success' ? '✅ 成功' : '处理中...'}
                                                        </div>
                                                    </div>
                                                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                                                        <span className="text-sm font-bold text-slate-600">语音已合成，准备进入视频渲染阶段</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // 6. 数字人视频渲染 (avatar-render)
                                        if (node.id === 'avatar-render') {
                                            return (
                                                <div className="space-y-6">
                                                    <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2rem] text-white shadow-xl">
                                                        <div className="text-[10px] uppercase font-black opacity-60 tracking-[0.2em] mb-2">🎬 视频渲染</div>
                                                        <div className="text-xl font-black mb-2">数字人视频合成完成</div>
                                                        <div className="flex items-center gap-2 text-sm opacity-80">
                                                            <span className="w-2 h-2 bg-white rounded-full"></span>
                                                            状态: {output.status === 'success' ? '✅ 渲染成功' : '处理中...'}
                                                        </div>
                                                    </div>
                                                    {output.videoUrl && (
                                                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                            <div className="text-[10px] uppercase font-black text-emerald-600 tracking-wider mb-2">视频预览</div>
                                                            <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                                                <span className="text-sm">🎥 视频预览区域（即将上线）</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // 7. 周计划 (weekly-plan) - 数字人模式
                                        if (node.id === 'weekly-plan' && output.topics) {
                                            return (
                                                <div className="space-y-6">
                                                    <div className="p-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-[2rem] text-white shadow-xl">
                                                        <div className="text-[10px] uppercase font-black opacity-60 tracking-[0.2em] mb-2">📅 发布计划</div>
                                                        <div className="text-xl font-black mb-2">数字人视频发布排期</div>
                                                        <div className="text-sm opacity-80">频率: {output.frequency}</div>
                                                    </div>
                                                    {Array.isArray(output.topics) && output.topics.length > 0 && (
                                                        <div className="space-y-2">
                                                            <div className="text-[10px] uppercase font-black text-slate-400 tracking-widest">主题规划</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {output.topics.map((topic: string, i: number) => (
                                                                    <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                                                                        {topic}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // 默认 JSON 渲染
                                        return <pre className="font-mono text-sm leading-relaxed overflow-x-auto">{JSON.stringify(node.details.output, null, 2)}</pre>

                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Live Progress Bar (Processing State) */}
                        {node.status === NodeStatus.PROCESSING && (
                            <div className="p-8 rounded-[2rem] bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center gap-8 animate-in fade-in duration-500">
                                <div className="flex-shrink-0 w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg ring-8 ring-blue-500/5">
                                    <span className="text-lg font-black text-blue-600">{node.details.progress || 0}%</span>
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">执行中</h4>
                                    <div className="flex items-center gap-2 text-slate-600 font-bold text-base">
                                        <ChevronRight size={18} className="text-blue-500" />
                                        {node.details.currentAction || "正在初始化..."}
                                    </div>
                                    {node.details.eta && <p className="text-slate-400 text-xs font-medium italic">预计完成: {node.details.eta}</p>}
                                </div>
                            </div>
                        )}

                        {/* Error Display */}
                        {node.status === NodeStatus.FAILED && node.details.error && (
                            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200">
                                <p className="text-rose-700 font-medium">{node.details.error}</p>
                            </div>
                        )}

                        {/* Golden Quotes Grid */}
                        {node.details.goldenQuotes && node.details.goldenQuotes.length > 0 && (
                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">提取金句</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {node.details.goldenQuotes.map((quote, idx) => (
                                        <div key={idx} className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-slate-600 text-sm font-medium italic shadow-sm hover:shadow-md transition-shadow">
                                            "{quote}"
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Features List */}
                        {node.details.features && node.details.features.length > 0 && (
                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">提取特征</label>
                                <div className="flex flex-wrap gap-2">
                                    {node.details.features.map((feature, idx) => (
                                        <span key={idx} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-slate-600 text-sm font-medium">
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LogDetail;
