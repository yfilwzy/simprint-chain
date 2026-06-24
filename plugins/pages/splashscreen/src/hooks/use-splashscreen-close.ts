import { useCallback } from 'react';
import { invoke } from '@/lib/tauri';

/**
 * Splashscreen 关闭处理 Hook
 */
export function useSplashscreenClose() {
  const handleClose = useCallback(async () => {
    try {
      await invoke('close_program'); // 直接请求后端退出应用
    } catch (error) {
      console.error('[SplashscreenClose] 退出应用失败:', error);
    }
  }, []);

  return {
    handleClose,
  };
}
