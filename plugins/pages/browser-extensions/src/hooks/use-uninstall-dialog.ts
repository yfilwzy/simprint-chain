import { useState } from 'react';
import type { ExtensionItem } from '../types';

interface UseUninstallDialogReturn {
  uninstallDialogOpen: boolean;
  uninstallingExt: ExtensionItem | null;
  action: 'uninstall' | 'remove';
  openUninstallDialog: (extension: ExtensionItem) => void;
  openRemoveDialog: (extension: ExtensionItem) => void;
  closeUninstallDialog: () => void;
}

/**
 * 卸载对话框状态管理 Hook
 */
export function useUninstallDialog(): UseUninstallDialogReturn {
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false);
  const [uninstallingExt, setUninstallingExt] = useState<ExtensionItem | null>(null);
  const [action, setAction] = useState<'uninstall' | 'remove'>('uninstall');

  const openUninstallDialog = (extension: ExtensionItem) => {
    setAction('uninstall');
    setUninstallingExt(extension);
    setUninstallDialogOpen(true);
  };

  const openRemoveDialog = (extension: ExtensionItem) => {
    setAction('remove');
    setUninstallingExt(extension);
    setUninstallDialogOpen(true);
  };

  const closeUninstallDialog = () => {
    setUninstallDialogOpen(false);
    setUninstallingExt(null);
    setAction('uninstall');
  };

  return {
    uninstallDialogOpen,
    uninstallingExt,
    action,
    openUninstallDialog,
    openRemoveDialog,
    closeUninstallDialog,
  };
}
