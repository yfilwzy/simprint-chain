import { create } from 'zustand';
import type { User } from '../../types/store.types';
import type { AuthActions, AuthState } from './auth-store.types';
import {
  clearRememberedCredentialSafely,
  ensureStateConsistency,
  tryAutoLogin,
} from './auth-store.utils';

/**
 * Auth Store
 * 专门管理用户认证相关的状态
 */
export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  // 初始状态
  user: null,
  isAuthenticated: false,
  isInitializing: false,
  currentWorkspaceUuid: null,
  currentTeamUuid: null,

  // Actions
  setUser: (user: User) =>
    set({
      user,
      isAuthenticated: true,
      currentWorkspaceUuid: user.current_workspace_uuid || null,
      currentTeamUuid: user.current_team_uuid || null,
    }),

  clearUser: () =>
    set({
      user: null,
      isAuthenticated: false,
      currentWorkspaceUuid: null,
      currentTeamUuid: null,
    }),

  setCurrentWorkspace: (workspaceUuid: string | null) =>
    set({
      currentWorkspaceUuid: workspaceUuid,
      user: get().user
        ? {
            ...get().user!,
            current_workspace_uuid: workspaceUuid,
          }
        : null,
    }),

  setCurrentTeam: (teamUuid: string | null) =>
    set({
      currentTeamUuid: teamUuid,
      user: get().user
        ? {
            ...get().user!,
            current_team_uuid: teamUuid,
          }
        : null,
    }),

  initAuth: async () => {
    // 如果正在初始化，直接返回
    if (get().isInitializing) {
      return;
    }

    // 如果 Store 中已有用户信息，说明已经登录，不需要做任何事
    if (get().user) {
      return;
    }

    set({ isInitializing: true });

    try {
      // 动态导入 invoke，避免在非 Tauri 环境中报错
      const { invoke } = await import('@tauri-apps/api/core');

      // 尝试使用记住的凭证自动登录
      const rememberedCredential = (await invoke('get_remembered_credential')) as
        | [string, string]
        | null;

      if (rememberedCredential) {
        const [email, refreshToken] = rememberedCredential;
        const autoLoginSuccess = await tryAutoLogin(invoke, email, refreshToken, set);

        if (autoLoginSuccess) {
          return; // 自动登录成功，直接返回
        }

        // 自动登录失败（可能是 refresh_token 过期），清除保存的凭证
        console.warn('[AuthStore] 自动登录失败，清除保存的凭证');
        await clearRememberedCredentialSafely(invoke);
      }

      // 检查并修复状态一致性
      await ensureStateConsistency(invoke);

      // 确保状态一致：无用户信息 = 未登录
      set({
        user: null,
        isAuthenticated: false,
        isInitializing: false,
      });
    } catch (error) {
      console.error('[AuthStore] 初始化认证状态失败:', error);
      // 初始化失败，确保状态一致
      set({
        user: null,
        isAuthenticated: false,
        isInitializing: false,
      });
    }
  },
}));
