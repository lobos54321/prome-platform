// ============================================
// 小红书自动化系统错误处理
// ============================================

/**
 * 基础错误类
 */
export class XiaohongshuError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'XiaohongshuError';
    Object.setPrototypeOf(this, XiaohongshuError.prototype);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends XiaohongshuError {
  constructor(message: string = '网络连接失败，请检查网络后重试') {
    super(message, 'NETWORK_ERROR', true);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends XiaohongshuError {
  constructor(message: string = '请求超时，请稍后重试') {
    super(message, 'TIMEOUT_ERROR', true);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends XiaohongshuError {
  constructor(message: string = '未登录或登录已过期，请重新登录') {
    super(message, 'AUTH_ERROR', true);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends XiaohongshuError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', true);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * API 错误
 */
export class APIError extends XiaohongshuError {
  constructor(message: string, public statusCode?: number) {
    super(message, 'API_ERROR', true);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * 判断错误是否可恢复
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof XiaohongshuError) {
    return error.recoverable;
  }
  return false;
}

/**
 * 格式化错误消息
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof XiaohongshuError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '未知错误';
}
