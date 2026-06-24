import { useState } from 'react';
import type { ExtensionItem } from '../types';

interface UseHomepageDialogReturn {
  homepageDialogOpen: boolean;
  homepageExtension: ExtensionItem | null;
  openHomepageDialog: (extension: ExtensionItem) => void;
  closeHomepageDialog: () => void;
}

/**
 * 访问主页对话框状态管理 Hook
 */
export function useHomepageDialog(): UseHomepageDialogReturn {
  const [homepageDialogOpen, setHomepageDialogOpen] = useState(false);
  const [homepageExtension, setHomepageExtension] = useState<ExtensionItem | null>(null);

  const openHomepageDialog = (extension: ExtensionItem) => {
    setHomepageExtension(extension);
    setHomepageDialogOpen(true);
  };

  const closeHomepageDialog = () => {
    setHomepageDialogOpen(false);
    setHomepageExtension(null);
  };

  return {
    homepageDialogOpen,
    homepageExtension,
    openHomepageDialog,
    closeHomepageDialog,
  };
}
