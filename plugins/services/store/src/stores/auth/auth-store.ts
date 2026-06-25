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
 *
 * 【免登录版改造】isAuthenticated 恒为 true，initAuth 跳过服务器调用，
 * user 使用本地默认用户对象兜底，避免组件因 user=null 崩溃。
 */
// 免登录版本地默认用户（避免组件因 user=null 崩溃）
const LOCAL_DEFAULT_USER: User = {
  uuid: 'local-user',
  id: 'local-user',
  nickname: '本地用户',
  email: 'local@localhost',
  status: 'active',
  current_workspace_uuid: null,
  current_team_uuid: null,
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  // 初始状态（免登录版：默认已认证 + 本地用户）
  user: LOCAL_DEFAULT_USER,
  isAuthenticated: true,
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
      user: LOCAL_DEFAULT_USER,
      isAuthenticated: true, // 免登录版：清除后仍保持已认证
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
    // 【免登录版】跳过所有服务器登录调用，直接保持已认证状态
    set({
      user: LOCAL_DEFAULT_USER,
      isAuthenticated: true,
      isInitializing: false,
    });
  },
}));
