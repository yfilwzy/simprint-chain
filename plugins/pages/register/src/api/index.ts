/**
 * 注册 API 服务
 */
import { invoke } from '@/lib/tauri';
import { post, isSuccess } from '@/lib/request';
import type {
  SendCodeRequest,
  RegisterPayload,
  RegisterResponseData,
  CodeType,
} from './index.types';

// 导出类型
export * from './index.types';

// Tauri 命令配置
export const TAURI_COMMANDS = {
  REGISTER: 'register',
} as const;

// HTTP API 端点配置
export const API_ENDPOINTS = {
  SEND_CODE: 'users/register-send-code',
} as const;

/**
 * API 响应格式
 */
interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

/**
 * 发送验证码（HTTP API）
 */
export async function sendVerificationCode(
  email: string,
  type: CodeType = 'register'
): Promise<void> {
  const requestData: SendCodeRequest = {
    email,
    type,
  };

  const result = await post(API_ENDPOINTS.SEND_CODE, requestData);

  if (!isSuccess(result)) {
    throw new Error(result.message || '发送验证码失败');
  }
}

/**
 * 用户注册（Tauri 命令）
 *
 * 注意：注册必须通过 Tauri 命令进行，因为：
 * 1. 需要生成 RSA 公钥
 * 2. 需要获取机器信息
 * 3. 需要保存 access_token 和 refresh_token
 *
 * @param email - 邮箱
 * @param password - 密码
 * @param code - 验证码
 * @param referralCode - 邀请码（可选）
 */
export async function register(
  email: string,
  password: string,
  code: string,
  referralCode?: string
): Promise<RegisterResponseData> {
  const payload: RegisterPayload = {
    email,
    password,
    code,
    ...(referralCode && { referral_code: referralCode }),
  };

  const result = (await invoke(TAURI_COMMANDS.REGISTER, {
    payload,
  })) as ApiResponse<RegisterResponseData>;

  if (result.code !== 1) {
    throw new Error(result.message || '注册失败');
  }

  return result.data!;
}
