/**
 * Splashscreen 插件类型定义
 */

export interface SplashscreenState {
  loadingText: string;
  progress?: number; // 0-100 的进度百分比
  errorMessage: string | null;
  connectionFailed: boolean;
  showCloseButton: boolean;
  isUpdating?: boolean; // 是否正在执行更新
}

export interface SplashscreenEvents {
  onProgress?: (text: string) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

export interface ParticleConfig {
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
}
