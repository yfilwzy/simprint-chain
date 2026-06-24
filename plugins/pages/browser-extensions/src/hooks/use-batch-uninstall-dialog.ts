import { useState } from 'react';

interface UseBatchUninstallDialogReturn {
  batchUninstallDialogOpen: boolean;
  openBatchUninstallDialog: () => void;
  closeBatchUninstallDialog: () => void;
}

/**
 * 批量卸载对话框状态管理 Hook
 */
export function useBatchUninstallDialog(): UseBatchUninstallDialogReturn {
  const [batchUninstallDialogOpen, setBatchUninstallDialogOpen] = useState(false);

  const openBatchUninstallDialog = () => {
    setBatchUninstallDialogOpen(true);
  };

  const closeBatchUninstallDialog = () => {
    setBatchUninstallDialogOpen(false);
  };

  return {
    batchUninstallDialogOpen,
    openBatchUninstallDialog,
    closeBatchUninstallDialog,
  };
}
