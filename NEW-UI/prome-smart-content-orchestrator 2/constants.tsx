
import React from 'react';
import { 
  FileText, Brain, ImageIcon, Layers, Mic, Video, PlayCircle, Cpu, Wand2, Zap
} from 'lucide-react';
import { WorkflowMode, NodeStatus, WorkflowNode } from './types';

export const WORKFLOW_CONFIGS: Record<WorkflowMode, WorkflowNode[]> = {
  [WorkflowMode.IMAGE_TEXT]: [
    {
      id: 'it-1',
      title: 'Dify 智能母文案生成',
      agent: 'Dify Marketing Agent',
      desc: '基于产品信息生成初始高转化营销文案',
      status: NodeStatus.COMPLETED,
      icon: FileText,
      details: {
        input: 'Product: Sydney Luxury Villa, Target: Investors, Tone: High-end',
        output: '标题: 👑 悉尼之巅：定义塔尖阶层的居住美学\n正文: 在Leppington的核心地带...',
        timeTaken: '2.8s'
      }
    },
    {
      id: 'it-2',
      title: 'CopyAnalyzer 策略分析',
      agent: 'Content Logic Bot',
      desc: '提取金句，计算权重，决定分发策略',
      status: NodeStatus.COMPLETED,
      icon: Brain,
      details: {
        strategy: 'SPLIT_INTO_SEGMENTS (深度拆分)',
        goldenQuotes: ['"不仅是一座房子，更是一份传承"', '"5%首付撬动千万资产"'],
        readabilityScore: 92,
        timeTaken: '0.5s'
      }
    },
    {
      id: 'it-3',
      title: 'ImageAdaptationBrain 评估',
      agent: 'Vision Strategist',
      desc: '分析图片与文案匹配度，规划补充素材',
      status: NodeStatus.PROCESSING,
      icon: ImageIcon,
      details: {
        currentAction: '分析上传图片中... 发现缺少卧室采光细节',
        progress: 65,
        usableImages: 2,
      }
    },
    {
      id: 'it-4',
      title: 'GeminiImage 生成 & 编排',
      agent: 'Gemini Imagen 3',
      desc: '根据 Brain 需求生成高精图片并合成任务',
      status: NodeStatus.PENDING,
      icon: Wand2,
      details: {
        currentAction: 'Waiting for visual score...'
      }
    },
    {
      id: 'it-5',
      title: 'xhs_daily_tasks 入库',
      agent: 'Content Executor',
      desc: '发布至待审核任务列表',
      status: NodeStatus.PENDING,
      icon: Zap,
      details: {}
    }
  ],
  [WorkflowMode.AVATAR_VIDEO]: [
    {
      id: 'av-1',
      title: 'Dify 脚本编排',
      agent: 'Script Master Agent',
      desc: '拆解口播节奏与分镜表情标注',
      status: NodeStatus.COMPLETED,
      icon: FileText,
      details: {
        output: 'Step 1: 热情开场 (5s) \nStep 2: 痛点揭秘 (10s) \nStep 3: 呼吁行动 (5s)',
        timeTaken: '1.5s'
      }
    },
    {
      id: 'av-2',
      title: 'RunningHub TTS 语音克隆',
      agent: 'Index Voice Engine',
      desc: '合成带情感的真人克隆音轨',
      status: NodeStatus.COMPLETED,
      icon: Mic,
      details: {
        audioUrl: 'https://cdn.example.com/audio/clone_08.mp3',
        timeTaken: '12.4s'
      }
    },
    {
      id: 'av-3',
      title: '数字人渲染任务',
      agent: 'Avatar Renderer v2',
      desc: '唇形同步与身体姿态融合渲染',
      status: NodeStatus.PROCESSING,
      icon: Video,
      details: {
        currentAction: '渲染第 124/450 帧',
        progress: 28,
        eta: '约 1 分 45 秒'
      }
    },
    {
      id: 'av-4',
      title: '视频质量检查 (VQA)',
      agent: 'Final Inspector',
      desc: '检查画面瑕疵与音画同步率',
      status: NodeStatus.PENDING,
      icon: Layers,
      details: {}
    }
  ],
  [WorkflowMode.UGC_VIDEO]: [
    {
      id: 'ugc-1',
      title: 'N8n 工作流初始化',
      agent: 'N8n Orchestrator',
      desc: '建立会话，开启多模态分析链路',
      status: NodeStatus.COMPLETED,
      icon: PlayCircle,
      details: {
        sessionId: 'agent_ugc_2024_09_15_X82',
        timeTaken: '0.2s'
      }
    },
    {
      id: 'ugc-2',
      title: 'GPT-4o 视觉特征拆解',
      agent: 'Visual Intelligence',
      desc: '深度分析产品图：色彩、材质、光影、人物特征',
      status: NodeStatus.COMPLETED,
      icon: Brain,
      details: {
        features: ['主色调: #FFFFFF', '材质: 玻璃幕墙', '场景: 户外阳光'],
        timeTaken: '4.2s'
      }
    },
    {
      id: 'ugc-3',
      title: 'Nano Banana 场景生成',
      agent: 'Fal.ai Stable Image',
      desc: '生成高度拟真的 UGC 手持拍摄背景图',
      status: NodeStatus.COMPLETED,
      icon: ImageIcon,
      details: {
        promptDraft: 'Cinematic handheld shot, reflection on window...',
        timeTaken: '6.8s'
      }
    },
    {
      id: 'ugc-4',
      title: 'Veo3 动态视频生成',
      agent: 'Kie.ai Veo3 Engine',
      desc: '基于场景图与文案生成 8s 关键镜头',
      status: NodeStatus.PROCESSING,
      icon: Video,
      details: {
        currentAction: '正在执行多片段合并生成...',
        progress: 42,
        eta: '约 3 分钟'
      }
    },
    {
      id: 'ugc-5',
      title: 'FFmpeg 自动混剪',
      agent: 'Media Processor',
      desc: '合成转场、背景音乐与任务回调',
      status: NodeStatus.PENDING,
      icon: Layers,
      details: {}
    }
  ]
};
