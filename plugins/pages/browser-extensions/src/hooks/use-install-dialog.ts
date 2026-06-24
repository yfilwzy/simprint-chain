import { useState } from 'react';
import type { StoreExtension } from '../types';

interface UseInstallDialogReturn {
  installDialogOpen: boolean;
  installingExt: StoreExtension | null;
  installGroups: string[];
  installForTeam: boolean;
  openInstallDialog: (extension: StoreExtension) => void;
  closeInstallDialog: () => void;
  toggleInstallGroup: (group: string) => void;
  setInstallForTeam: (forTeam: boolean) => void;
}

/**
 * 安装对话框状态管理 Hook
 */
export function useInstallDialog(): UseInstallDialogReturn {
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installingExt, setInstallingExt] = useState<StoreExtension | null>(null);
  const [installGroups, setInstallGroups] = useState<string[]>([]);
  const [installForTeam, setInstallForTeam] = useState(false);

  const openInstallDialog = (extension: StoreExtension) => {
    setInstallingExt(extension);
    setInstallGroups([]);
    setInstallForTeam(false);
    setInstallDialogOpen(true);
  };

  const closeInstallDialog = () => {
    setInstallDialogOpen(false);
    setInstallingExt(null);
    setInstallGroups([]);
    setInstallForTeam(false);
  };

  const toggleInstallGroup = (group: string) => {
    setInstallGroups((prev) => {
      if (prev.includes(group)) {
        return prev.filter((g) => g !== group);
      } else {
        return [...prev, group];
      }
    });
  };

  return {
    installDialogOpen,
    installingExt,
    installGroups,
    installForTeam,
    openInstallDialog,
    closeInstallDialog,
    toggleInstallGroup,
    setInstallForTeam,
  };
}
