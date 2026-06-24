import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * 窗口显示控制 Hook
 * 负责在内容准备好后显示 splashscreen 窗口
 */
export function useSplashscreenWindow() {
  const showWindowWhenReady = useCallback(async () => {
    try {
      const splashWindow = getCurrentWindow();
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          setTimeout(async () => {
            try {
              await splashWindow.show();
              await splashWindow.setFocus();
            } catch (error) {
              console.error('显示窗口失败:', error);
            }
          }, 100);
        });
      });
    } catch (error) {
      console.error('显示窗口失败:', error);
    }
  }, []);

  return { showWindowWhenReady };
}
