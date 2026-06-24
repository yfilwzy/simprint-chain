import { useState } from 'react';
import type { ViewMode } from '../types';

interface UseViewModeReturn {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

/**
 * 视图模式管理 Hook
 */
export function useViewMode(): UseViewModeReturn {
  const [viewMode, setViewMode] = useState<ViewMode>('installed');

  return {
    viewMode,
    setViewMode,
  };
}
