import { useMemo } from 'react';
import type { ExtensionItem } from '../types';

interface ExtensionStats {
  installedCount: number;
  updateCount: number;
  availableCount: number;
  totalCount: number;
}

/**
 * 扩展统计数据 Hook
 */
export function useExtensionStats(extensions: ExtensionItem[]): ExtensionStats {
  return useMemo(() => {
    const installedCount = extensions.filter(
      (e) => e.status === 'installed' || e.status === 'active' || e.status === 'disabled'
    ).length;
    const updateCount = extensions.filter((e) => e.status === 'update').length;
    const availableCount = extensions.filter((e) => e.status === 'available').length;

    return {
      installedCount,
      updateCount,
      availableCount,
      totalCount: extensions.length,
    };
  }, [extensions]);
}
