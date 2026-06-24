import type { User } from '../../types/store.types';
import type { AuthStateSetter, LoginResponse, TauriInvoke } from './auth-store.types';

/**
 * 将服务端用户信息转换为前端 User 类型
 */
export function mapUserInfo(userInfo: LoginResponse['user_info'], fallbackEmail: string): User {
  return {
    uuid: userInfo?.uuid || '',
    id: userInfo?.id || '',
    nickname: userInfo?.nickname,
    email: userInfo?.email || fallbackEmail,
    phone: userInfo?.phone,
    avatar: userInfo?.avatar_hash,
    status: userInfo?.status || 'active',
  };
}

/**
 * 清除记住的凭证（静默处理错误）
 */
export async function clearRememberedCredentialSafely(invoke: TauriInvoke): Promise<void> {
  try {
    await invoke('clear_remembered_credential');
  } catch (error) {
    console.warn('[AuthStore] 清除记住的凭证失败:', error);
  }
}

/**
 * 更新保存的 refresh_token（如果服务端返回了新的）
 */
export async function updateRememberedCredentialIfNeeded(
  invoke: TauriInvoke,
  email: string,
  oldToken: string,
  newToken: string
): Promise<void> {
  if (newToken && newToken !== oldToken) {
    try {
      await invoke('save_remembered_credential', {
        email: email,
        refreshToken: newToken,
      });
    } catch (error) {
      console.warn('[AuthStore] 更新记住的凭证失败:', error);
    }
  }
}

/**
 * 尝试使用记住的凭证自动登录
 */
export async function tryAutoLogin(
  invoke: TauriInvoke,
  email: string,
  refreshToken: string,
  set: AuthStateSetter
): Promise<boolean> {
  try {
    const result = (await invoke('login', {
      payload: {
        type: 'remember_password',
        data: {
          email: email,
          refresh_token: refreshToken,
        },
      },
    })) as { code: number; message: string; data?: LoginResponse };

    if (result.code !== 1 || !result.data) {
      return false;
    }

    const loginResponse = result.data;

    // 更新保存的 refresh_token（如果服务端返回了新的）
    await updateRememberedCredentialIfNeeded(
      invoke,
      email,
      refreshToken,
      loginResponse.refresh_token
    );

    // 更新 Store 中的用户状态
    if (loginResponse.user_info) {
      set({
        user: mapUserInfo(loginResponse.user_info, email),
        isAuthenticated: true,
        isInitializing: false,
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('[AuthStore] 自动登录失败:', error);
    return false;
  }
}

/**
 * 检查并修复状态一致性
 */
export async function ensureStateConsistency(invoke: TauriInvoke): Promise<void> {
  try {
    const isLoggedIn = (await invoke('is_logged_in')) as boolean;

    if (isLoggedIn) {
      console.warn('[AuthStore] 检测到状态不一致：Tauri 有凭证但 Store 无用户信息，清除凭证');
      await invoke('logout');
    }
  } catch (error) {
    console.warn('[AuthStore] 检查状态一致性失败:', error);
  }
}
