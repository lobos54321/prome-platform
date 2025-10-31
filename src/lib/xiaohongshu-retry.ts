// ============================================
// 小红书自动化系统重试机制
// ============================================

/**
 * 重试配置选项
 */
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 10000, // 10秒
};

/**
 * 指数退避重试
 * @param fn 需要重试的函数
 * @param options 重试配置
 * @returns 函数执行结果
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // 如果是最后一次尝试，抛出错误
      if (attempt === opts.maxRetries - 1) {
        throw error;
      }
      
      // 计算延迟时间（指数退避）
      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt),
        opts.maxDelay
      );
      
      // 调用重试回调
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, error as Error);
      }
      
      // 等待后重试
      await sleep(delay);
    }
  }
  
  throw new Error('Should not reach here');
}

/**
 * 睡眠函数
 * @param ms 毫秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带取消功能的睡眠
 * @param ms 毫秒
 * @param signal AbortSignal
 */
export function sleepWithCancel(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    
    const timeoutId = setTimeout(resolve, ms);
    
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new Error('Aborted'));
      });
    }
  });
}
