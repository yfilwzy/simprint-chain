import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { SplashscreenState } from '../types';

/**
 * Tauri 事件负载类型
 */
interface TauriEventPayload {
  payload?: {
    text?: string;
    message?: string;
    percentage?: number;
    error?: string;
    error_message?: string;
  };
}

/**
 * Splashscreen 事件监听 Hook
 * 负责监听后端事件并更新状态
 */
export function useSplashscreenEvents() {
  const [state, setState] = useState<SplashscreenState>({
    loadingText: '初始化中...',
    errorMessage: null,
    connectionFailed: false,
    showCloseButton: false,
    progress: undefined,
    isUpdating: false,
  });

  useEffect(() => {
    let unsubscribeProgress: (() => void) | null = null;
    let unsubscribeReady: (() => void) | null = null;
    let unsubscribeError: (() => void) | null = null;
    let unsubscribeConnectionFailed: (() => void) | null = null;
    let unsubscribeUpdateDownloading: (() => void) | null = null;
    let unsubscribeUpdateProgress: (() => void) | null = null;
    let unsubscribeUpdateComplete: (() => void) | null = null;
    let unsubscribeUpdateFailed: (() => void) | null = null;
    let unsubscribeUpdatePartial: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        unsubscribeProgress = await listen('splashscreen-progress', (event: TauriEventPayload) => {
          const { text } = event.payload || {};
          if (text) {
            setState((prev) => ({ ...prev, loadingText: text, errorMessage: null }));
          }
        });

        unsubscribeReady = await listen('splashscreen-ready', async () => {
          setState((prev) => ({
            ...prev,
            loadingText: '加载完成',
            progress: 100,
            isUpdating: false,
          }));
        });

        unsubscribeError = await listen('splashscreen-error', (event: TauriEventPayload) => {
          const { message } = event.payload || {};
          setState((prev) => ({
            ...prev,
            errorMessage: message || '加载过程中发生错误',
          }));
        });

        unsubscribeConnectionFailed = await listen('splashscreen-connection-failed', () => {
          setState((prev) => ({
            ...prev,
            connectionFailed: true,
            showCloseButton: true,
            loadingText: '服务器连接失败，请尝试重新启动或重新下载',
          }));
        });

        // 更新：下载开始
        unsubscribeUpdateDownloading = await listen('update_downloading', () => {
          setState((prev) => ({
            ...prev,
            isUpdating: true,
            loadingText: '正在下载更新...',
            errorMessage: null,
          }));
        });

        // 更新：下载进度（已聚合的百分比）
        unsubscribeUpdateProgress = await listen(
          'update_download_progress',
          (event: TauriEventPayload) => {
            const { percentage } = event.payload || {};
            const progressNumber =
              typeof percentage === 'number' ? Math.max(0, Math.min(100, percentage)) : undefined;
            setState((prev) => ({
              ...prev,
              isUpdating: true,
              progress: progressNumber ?? prev.progress,
              loadingText: '正在下载更新...',
              errorMessage: null,
            }));
          }
        );

        // 更新：下载完成
        unsubscribeUpdateComplete = await listen('update_download_complete', () => {
          setState((prev) => ({
            ...prev,
            isUpdating: false,
            progress: 100,
            loadingText: '更新下载完成，准备安装...',
          }));
        });

        // 更新：下载失败或部分失败
        unsubscribeUpdateFailed = await listen(
          'update_download_failed',
          (event: TauriEventPayload) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payloadData = (event.payload as any) || {};
            const message =
              payloadData?.error_message || payloadData?.error || '下载更新失败，继续当前版本';
            setState((prev) => ({
              ...prev,
              isUpdating: false,
              loadingText: '下载更新失败，继续当前版本',
              errorMessage: message,
            }));
          }
        );
        unsubscribeUpdatePartial = await listen(
          'update_download_partial',
          (event: TauriEventPayload) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payloadData = (event.payload as any) || {};
            const message =
              payloadData?.error_message || '部分更新下载失败，已保留成功部分，继续当前版本';
            setState((prev) => ({
              ...prev,
              isUpdating: false,
              loadingText: '部分更新下载失败，继续当前版本',
              errorMessage: message,
            }));
          }
        );
      } catch (error) {
        console.error('[SplashscreenEvents] Failed to register event listeners:', error);
      }
    };

    setupListeners();

    return () => {
      unsubscribeProgress?.();
      unsubscribeReady?.();
      unsubscribeError?.();
      unsubscribeConnectionFailed?.();
      unsubscribeUpdateDownloading?.();
      unsubscribeUpdateProgress?.();
      unsubscribeUpdateComplete?.();
      unsubscribeUpdateFailed?.();
      unsubscribeUpdatePartial?.();
    };
  }, []);

  return state;
}
