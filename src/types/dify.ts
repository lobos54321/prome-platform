// Dify 相关的类型定义
export interface DifyResponse {
  event: string;
  conversation_id: string;
  message_id: string;
  created_at: number;
  task_id: string;
  id: string;
  answer: string;
  metadata?: {
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

export interface DifyError {
  code: string;
  message: string;
  status: number;
}

export interface DifyMessage {
  id: string;
  conversation_id: string;
  inputs: Record<string, unknown>;
  query: string;
  answer: string;
  message_files: unknown[];
  created_at: number;
}
