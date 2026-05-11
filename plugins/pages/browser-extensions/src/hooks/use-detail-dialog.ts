import { useState } from 'react';

import type { ExtensionItem } from '../types';

interface UseDetailDialogReturn {
  detailDialogOpen: boolean;
  viewingExtension: ExtensionItem | null;
  openDetailDialog: (extension: ExtensionItem) => void;
  closeDetailDialog: () => void;
}

/**
 * 详情对话框状态管理 Hook
 */
export function useDetailDialog(): UseDetailDialogReturn {
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [viewingExtension, setViewingExtension] = useState<ExtensionItem | null>(null);

  const openDetailDialog = (extension: ExtensionItem) => {
    setViewingExtension(extension);
    setDetailDialogOpen(true);
  };

  const closeDetailDialog = () => {
    setDetailDialogOpen(false);
    setViewingExtension(null);
  };

  return {
    detailDialogOpen,
    viewingExtension,
    openDetailDialog,
    closeDetailDialog,
  };
}
