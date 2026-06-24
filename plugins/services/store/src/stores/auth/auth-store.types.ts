import type { User } from '../../types/store.types';

/**
 * 认证状态接口
 */
export interface AuthState {
  /** 用户信息 */
  user: User | null;
  /** 是否已登录 */
  isAuthenticated: boolean;
  /** 是否正在初始化 */
  isInitializing: boolean;
  /** 当前工作空间 UUID */
  currentWorkspaceUuid: string | null;
  /** 当前团队 UUID */
  currentTeamUuid: string | null;
}

/**
 * 认证 Actions
 */
export interface AuthActions {
  /** 设置用户信息（登录） */
  setUser: (user: User) => void;
  /** 清除用户信息（登出） */
  clearUser: () => void;
  /** 初始化认证状态（检查登录状态并获取用户信息） */
  initAuth: () => Promise<void>;
  /** 设置当前工作空间 */
  setCurrentWorkspace: (workspaceUuid: string | null) => void;
  /** 设置当前团队 */
  setCurrentTeam: (teamUuid: string | null) => void;
}

/**
 * 登录响应数据结构
 */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user_info?: {
    uuid?: string;
    id?: string;
    nickname?: string;
    email?: string;
    phone?: string;
    avatar_hash?: string;
    status?: string;
  };
}

/**
 * Tauri invoke 函数类型
 */

export type TauriInvoke = (
  cmd: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<any>;

/**
 * Store setter 函数类型
 */
export type AuthStateSetter = (state: Partial<AuthState>) => void;
