import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@/lib/tauri';
import { listen } from '@tauri-apps/api/event';

/**
 * 窗口管理服务插件
 * 负责在主窗口内容渲染完成后显示窗口
 */
const WindowManagerService: React.FC = () => {
  const hasShownWindow = useRef(false);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  // 监听后端加载完成事件
  useEffect(() => {
    let unsubscribeLoadingComplete: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unsubscribeLoadingComplete = await listen('splashscreen-loading-complete', () => {
          setIsLoadingComplete(true);
        });
      } catch (error) {
        console.error(
          '[WindowManagerService] Failed to register loading complete listener:',
          error
        );
      }
    };

    setupListener();

    return () => {
      unsubscribeLoadingComplete?.();
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let checkCount = 0;
    const MAX_CHECKS = 500; // 最多检查 500 次（约 8 秒）

    const checkAndShowWindow = async () => {
      checkCount++;

      // 如果已经显示过窗口，不再重复显示
      if (hasShownWindow.current) {
        return;
      }

      // 如果检查次数过多，直接显示窗口（避免无限等待）
      if (checkCount > MAX_CHECKS) {
        console.warn('[WindowManagerService] 检查超时，强制关闭加载窗口并显示主窗口');
        hasShownWindow.current = true;
        try {
          await invoke('complete_and_show_main');
          console.log('[WindowManagerService] 加载窗口已关闭，主窗口已强制显示');
        } catch (error) {
          console.error('[WindowManagerService] 强制显示窗口失败:', error);
          hasShownWindow.current = false;
        }
        return;
      }

      const currentWindow = getCurrentWindow();

      // 只处理主窗口
      if (!currentWindow.label.includes('main')) {
        // 不是主窗口，停止检查
        return;
      }

      // 检查主窗口的 DOM 内容是否已渲染
      const rootElement = document.getElementById('root');
      const appElement = rootElement?.querySelector('.app') as HTMLElement | null;
      const isContentReady =
        rootElement &&
        rootElement.children.length > 0 &&
        rootElement.offsetHeight > 0 &&
        rootElement.offsetWidth > 0 &&
        appElement &&
        appElement.children.length > 0 &&
        appElement.offsetHeight > 0;

      // 加载完成且内容已准备好，通知后端关闭加载窗口并显示主窗口
      if (isLoadingComplete && isContentReady) {
        // 内容已渲染，使用双重 RAF + setTimeout 确保浏览器完成渲染后再显示窗口
        hasShownWindow.current = true;

        requestAnimationFrame(() => {
          requestAnimationFrame(async () => {
            // 额外的延迟确保所有样式、布局都已完成
            setTimeout(async () => {
              try {
                // 调用后端命令关闭加载窗口并显示主窗口
                await invoke('complete_and_show_main');
                console.log(
                  '[WindowManagerService] 关闭加载窗口并显示主窗口请求已发送 (检查次数:',
                  checkCount,
                  ')'
                );
              } catch (error) {
                console.error('[WindowManagerService] 显示窗口失败:', error);
                // 如果失败，重置标志以便重试
                hasShownWindow.current = false;
              }
            }, 150);
          });
        });
      } else {
        // 每 50 次检查打印一次日志（避免日志过多）
        if (checkCount % 50 === 0) {
          console.log(
            '[WindowManagerService] 等待主窗口就绪...',
            '(检查次数:',
            checkCount,
            '加载完成:',
            isLoadingComplete,
            '内容就绪:',
            isContentReady,
            ')'
          );
        }
        // 还未准备好，继续检查（使用 RAF 避免阻塞）
        animationFrameId = requestAnimationFrame(checkAndShowWindow);
      }
    };

    // 延迟一点开始检查，确保 React 组件已挂载
    console.log('[WindowManagerService] 开始检查主窗口内容...');
    const timer = setTimeout(() => {
      // 使用 RAF 循环直到加载完成且内容准备好
      animationFrameId = requestAnimationFrame(checkAndShowWindow);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isLoadingComplete]);

  // 这个服务插件不渲染任何 UI
  return null;
};

/**
 * Window Manager 服务插件
 * 注意：这是一个特殊的服务插件，它不遵循标准的插件格式
 * 因为它需要在应用启动时就被使用，但不渲染任何 UI
 */
const windowManagerPlugin = {
  id: 'window-manager',
  name: 'Window Manager Service',
  version: '1.0.0',
  component: WindowManagerService,
  slots: [],
};

export default windowManagerPlugin;
