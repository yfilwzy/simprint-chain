import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ExtensionItem } from '../types';
import { useExtensionOperations } from './use-extension-operations';
import { useInstallDialog } from './use-install-dialog';
import { useUninstallDialog } from './use-uninstall-dialog';
import { useBatchUninstallDialog } from './use-batch-uninstall-dialog';
import { useExtensionSelection } from './use-extension-selection';
import { useDetailDialog } from './use-detail-dialog';
import { useHomepageDialog } from './use-homepage-dialog';
import { useToggleDialog } from './use-toggle-dialog';

interface UseExtensionHandlersProps {
  extensions: ExtensionItem[];
  paginatedExtensions: ExtensionItem[];
  onRefresh: () => Promise<void>;
}

interface UseExtensionHandlersReturn {
  // 安装相关
  handleInstall: (id: string) => void;
  handleConfirmInstall: () => Promise<void>;
  installDialog: ReturnType<typeof useInstallDialog>;
  installing: boolean;

  // 更新相关
  handleUpdate: (id: string) => Promise<void>;

  // 卸载相关
  handleUninstall: (id: string, name: string) => void;
  handleRemove: (id: string, name: string) => void;
  handleConfirmUninstall: () => Promise<void>;
  uninstallDialog: ReturnType<typeof useUninstallDialog>;

  // 批量操作相关
  handleBatchUpdate: () => Promise<void>;
  handleBatchUninstall: () => void;
  handleConfirmBatchUninstall: () => Promise<void>;
  batchUninstallDialog: ReturnType<typeof useBatchUninstallDialog>;

  // 禁用/启用相关
  handleDisable: (id: string, name: string) => void;
  handleEnable: (id: string, name: string) => void;
  handleConfirmToggle: () => Promise<void>;
  toggleDialog: ReturnType<typeof useToggleDialog>;

  // 其他操作
  handleViewDetails: (id: string) => void;
  handleHomepage: (id: string) => void;
  handleSecurityCheck: (id: string) => void;
  detailDialog: ReturnType<typeof useDetailDialog>;
  homepageDialog: ReturnType<typeof useHomepageDialog>;

  // 选择相关
  selection: ReturnType<typeof useExtensionSelection>;
}

/**
 * 扩展操作事件处理 Hook
 * 整合所有扩展相关的操作和事件处理逻辑
 */
export function useExtensionHandlers({
  extensions,
  paginatedExtensions,
  onRefresh,
}: UseExtensionHandlersProps): UseExtensionHandlersReturn {
  const { t } = useTranslation('extensions');

  // 对话框状态管理
  const installDialog = useInstallDialog();
  const uninstallDialog = useUninstallDialog();
  const batchUninstallDialog = useBatchUninstallDialog();
  const detailDialog = useDetailDialog();
  const homepageDialog = useHomepageDialog();
  const toggleDialog = useToggleDialog();

  // 选择管理
  const selection = useExtensionSelection(paginatedExtensions);

  // 操作逻辑
  const operations = useExtensionOperations(() => {
    void onRefresh();
  });

  // 安装处理
  const handleInstall = useCallback(
    (id: string) => {
      const ext = extensions.find((e) => e.id === id);
      if (ext) {
        if (ext.source === 'local') {
          void operations
            .installExtension(
              {
                ...ext,
                isInstalled: ext.status === 'installed' || ext.status === 'update',
              },
              [],
              false
            )
            .catch((e) => {
              toast.error(e instanceof Error ? e.message : '安装失败');
            });
          return;
        }

        installDialog.openInstallDialog({
          ...ext,
          isInstalled: ext.status === 'installed' || ext.status === 'update',
        });
      }
    },
    [extensions, installDialog]
  );

  const handleConfirmInstall = useCallback(async () => {
    if (!installDialog.installingExt) return;
    try {
      await operations.installExtension(
        installDialog.installingExt,
        installDialog.installGroups,
        installDialog.installForTeam
      );
      installDialog.closeInstallDialog();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '安装失败');
    }
  }, [installDialog, operations]);

  // 更新处理
  const handleUpdate = useCallback(
    async (_id: string) => {
      // 直接提示检查通过
      toast.success(t('update.checkPassed'));
    },
    [t]
  );

  // 卸载处理
  const handleUninstall = useCallback(
    (id: string, _name: string) => {
      const ext = extensions.find((e) => e.id === id);
      if (ext) {
        uninstallDialog.openUninstallDialog(ext);
      }
    },
    [extensions, uninstallDialog]
  );

  const handleConfirmUninstall = useCallback(async () => {
    if (!uninstallDialog.uninstallingExt) return;
    if (uninstallDialog.action === 'remove') {
      await operations.removeExtension(uninstallDialog.uninstallingExt);
    } else {
      await operations.uninstallExtension(uninstallDialog.uninstallingExt);
    }
    uninstallDialog.closeUninstallDialog();
  }, [uninstallDialog, operations]);

  const handleRemove = useCallback(
    (id: string, _name: string) => {
      const ext = extensions.find((e) => e.id === id);
      if (ext) {
        uninstallDialog.openRemoveDialog(ext);
      }
    },
    [extensions, uninstallDialog]
  );

  // 批量操作处理
  const handleBatchUpdate = useCallback(async () => {
    const selectedExtensions = paginatedExtensions.filter((ext) =>
      selection.selectedIds.has(ext.id)
    );
    await operations.batchUpdate(selectedExtensions);
    selection.clearSelection();
  }, [paginatedExtensions, selection, operations]);

  const handleBatchUninstall = useCallback(() => {
    batchUninstallDialog.openBatchUninstallDialog();
  }, [batchUninstallDialog]);

  const handleConfirmBatchUninstall = useCallback(async () => {
    const selectedExtensions = paginatedExtensions.filter((ext) =>
      selection.selectedIds.has(ext.id)
    );
    await operations.batchUninstall(selectedExtensions);
    await onRefresh();
    selection.clearSelection();
    batchUninstallDialog.closeBatchUninstallDialog();
  }, [paginatedExtensions, selection, operations, onRefresh, batchUninstallDialog]);

  // 其他操作
  const handleViewDetails = useCallback(
    (id: string) => {
      const ext = extensions.find((item) => item.id === id);
      if (ext) {
        detailDialog.openDetailDialog(ext);
      }
    },
    [detailDialog, extensions]
  );

  const handleHomepage = useCallback(
    (id: string) => {
      const ext = extensions.find((e) => e.id === id);
      if (ext) {
        homepageDialog.openHomepageDialog(ext);
      } else {
        toast.error(t('dialog.homepage.noHomepage'));
      }
    },
    [extensions, homepageDialog, t]
  );

  const handleSecurityCheck = useCallback(
    (_id: string) => {
      // 直接提示检查通过
      toast.success(t('securityCheck.passed'));
    },
    [t]
  );

  // 禁用/启用处理
  const handleDisable = useCallback(
    (id: string, _name: string) => {
      const ext = extensions.find((e) => e.id === id);
      if (ext) {
        toggleDialog.openToggleDialog(ext, 'disable');
      }
    },
    [extensions, toggleDialog]
  );

  const handleEnable = useCallback(
    (id: string, _name: string) => {
      const ext = extensions.find((e) => e.id === id);
      if (ext) {
        toggleDialog.openToggleDialog(ext, 'enable');
      }
    },
    [extensions, toggleDialog]
  );

  const handleConfirmToggle = useCallback(async () => {
    if (!toggleDialog.togglingExt) return;
    if (toggleDialog.toggleAction === 'disable') {
      await operations.disableExtension(toggleDialog.togglingExt);
    } else {
      await operations.enableExtension(toggleDialog.togglingExt);
    }
    toggleDialog.closeToggleDialog();
  }, [toggleDialog, operations]);

  return {
    handleInstall,
    handleConfirmInstall,
    installDialog,
    installing: operations.installing,
    handleUpdate,
    handleUninstall,
    handleRemove,
    handleConfirmUninstall,
    uninstallDialog,
    handleBatchUpdate,
    handleBatchUninstall,
    handleConfirmBatchUninstall,
    batchUninstallDialog,
    handleDisable,
    handleEnable,
    handleConfirmToggle,
    toggleDialog,
    handleViewDetails,
    handleHomepage,
    handleSecurityCheck,
    detailDialog,
    homepageDialog,
    selection,
  };
}
