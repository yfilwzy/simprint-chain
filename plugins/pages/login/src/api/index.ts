/**
 * 登录 API 服务
 */
import { invoke } from '@/lib/tauri';
import type { LoginPayload, LoginResponseData, UserInfoResponse } from './index.types';

// 导出类型
export * from './index.types';

// Tauri 命令配置
export const TAURI_COMMANDS = {
  LOGIN: 'login',
  SAVE_REMEMBERED_CREDENTIAL: 'save_remembered_credential',
  CLEAR_REMEMBERED_CREDENTIAL: 'clear_remembered_credential',
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
 * 用户登录
 */
export async function login(email: string, password: string): Promise<LoginResponseData> {
  const payload: LoginPayload = {
    type: 'basic',
    data: { email, password },
  };

  const result = (await invoke(TAURI_COMMANDS.LOGIN, {
    payload,
  })) as ApiResponse<LoginResponseData>;

  if (result.code !== 1) {
    throw new Error(result.message || '登录失败');
  }

  return result.data!;
}

/**
 * 使用记住的凭证登录
 */
export async function loginWithRememberedCredential(
  email: string,
  refreshToken: string
): Promise<LoginResponseData> {
  const payload: LoginPayload = {
    type: 'remember',
    data: { email, refresh_token: refreshToken },
  };

  const result = (await invoke(TAURI_COMMANDS.LOGIN, {
    payload,
  })) as ApiResponse<LoginResponseData>;

  if (result.code !== 1) {
    throw new Error(result.message || '登录失败');
  }

  return result.data!;
}

/**
 * 保存记住的凭证
 */
export async function saveRememberedCredential(email: string, refreshToken: string): Promise<void> {
  await invoke(TAURI_COMMANDS.SAVE_REMEMBERED_CREDENTIAL, {
    email,
    refreshToken,
  });
}

/**
 * 清除记住的凭证
 */
export async function clearRememberedCredential(): Promise<void> {
  try {
    await invoke(TAURI_COMMANDS.CLEAR_REMEMBERED_CREDENTIAL);
  } catch (error) {
    console.warn('清除记住的凭证失败:', error);
    // 不影响登录流程，只记录警告
  }
}
