/**
 * 重置密码 API 类型定义
 */

/**
 * 验证码类型
 */
export type CodeType = 'register' | 'reset_password';

/**
 * 发送验证码请求
 */
export interface SendCodeRequest {
  email: string;
  type: CodeType;
}

/**
 * 重置密码请求
 */
export interface ResetPasswordRequest {
  email: string;
  code: string;
  new_password: string;
}
