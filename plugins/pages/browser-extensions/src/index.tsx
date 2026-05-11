import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { extensionsResources } from './i18n/resources';
import { useState, useEffect, useRef, useMemo } from 'react';
import { ExtensionHeader } from './components/extension-header';
import { ExtensionStats } from './components/extension-stats';
import { ExtensionTable } from './components/extension-table';
import { ExtensionBatchActions } from './components/extension-batch-actions';
import { ExtensionPagination } from './components/extension-pagination';
import { ExtensionStore } from './components/extension-store';
import { LocalExtensionLibrary } from './components/local-extension-library';
import { LocalExtensionImportDialog } from './components/local-extension-import-dialog';
import { ExtensionInstallDialog } from './components/extension-install-dialog';
import { ExtensionUninstallDialog } from './components/extension-uninstall-dialog';
import { ExtensionDetailDialog } from './components/extension-detail-dialog';
import { ExtensionHomepageDialog } from './components/extension-homepage-dialog';
import { ExtensionBatchUninstallDialog } from './components/extension-batch-uninstall-dialog';
import { ExtensionToggleDialog } from './components/extension-toggle-dialog';
import { useExtensions } from './hooks/use-extensions';
import { useExtensionFilters, useStoreExtensions } from './hooks/use-extension-filters';
import { useExtensionPagination } from './hooks/use-extension-pagination';
import { useExtensionStats } from './hooks/use-extension-stats';
import { useViewMode } from './hooks/use-view-mode';
import { useSearchPagination } from './hooks/use-search-pagination';
import { useExtensionHandlers } from './hooks/use-extension-handlers';
import {
  importLocalExtensionCrx,
  importLocalExtensionStoreUrl,
  listGroups,
  type GroupItem,
} from './api';
import { STORE_ITEMS_PER_PAGE } from './constants';
import type { SortOption } from './types';
import { toast } from 'sonner';

const BrowserExtensionsPage: React.FC = () => {
  const { t } = useTranslation('extensions');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [importingLocal, setImportingLocal] = useState(false);
  const [localImportDialogOpen, setLocalImportDialogOpen] = useState(false);

  // 分组数据
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 视图模式
  const { viewMode, setViewMode } = useViewMode();

  // 搜索和分页
  const { searchQuery, currentPage, handleSearchChange, handlePageChange } = useSearchPagination();
  const [storeCategory, setStoreCategory] = useState('all');
  const [storePageSize, setStorePageSize] = useState(STORE_ITEMS_PER_PAGE);
  const [storeSortBy, setStoreSortBy] = useState<SortOption>('downloads');

  // 数据获取 - 同时获取所有扩展和已安装扩展的数据
  const allExtensionsHook = useExtensions('all', 'all', {
    page: currentPage,
    pageSize: storePageSize,
    search: searchQuery,
    category: storeCategory === 'all' ? undefined : storeCategory,
    sortBy: storeSortBy,
    sortOrder: storeSortBy === 'name' ? 'asc' : 'desc',
  });
  // 将 scopeFilter 映射到 API 的 scope 参数：'all' -> 'all', 'team' -> 'team', 'personal' -> 'user'
  const apiScope = scopeFilter === 'personal' ? 'user' : scopeFilter === 'team' ? 'team' : 'all';
  const installedExtensionsHook = useExtensions('installed', apiScope);
  const localExtensionsHook = useExtensions('local');

  // 根据视图模式选择对应的数据和刷新函数
  const {
    extensions: viewExtensions,
    loading,
    error,
    refresh,
  } = viewMode === 'installed'
    ? installedExtensionsHook
    : viewMode === 'local'
      ? localExtensionsHook
      : allExtensionsHook;

  // 获取已安装扩展的数据（用于统计）
  const { extensions: installedExtensions } = installedExtensionsHook;

  const refreshRef = useRef(refresh);
  const skipRefreshEffectOnMountRef = useRef(true);

  // 保持 refresh 函数引用最新
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // 初始加载 - 同时加载两个数据源
  useEffect(() => {
    if (viewMode === 'installed') {
      void installedExtensionsHook.refresh();
    } else if (viewMode === 'local') {
      void localExtensionsHook.refresh();
    } else {
      void allExtensionsHook.refresh();
    }
  }, []);

  // 当切换视图模式或 scopeFilter 时，重新加载对应数据
  useEffect(() => {
    if (skipRefreshEffectOnMountRef.current) {
      skipRefreshEffectOnMountRef.current = false;
      return;
    }
    void refreshRef.current();
  }, [viewMode, scopeFilter]);

  useEffect(() => {
    if (viewMode !== 'store') {
      return;
    }
    void allExtensionsHook.refresh();
  }, [allExtensionsHook.refresh]);

  useEffect(() => {
    if (viewMode !== 'local') {
      return;
    }
    void localExtensionsHook.refresh();
  }, [localExtensionsHook.refresh, viewMode]);

  // 过滤
  // 注意：已安装视图模式下，API 返回的都是已安装的扩展，不需要再次过滤状态
  const allFilteredExtensions = useExtensionFilters(allExtensionsHook.extensions, {
    searchQuery,
    scopeFilter,
  });

  // 对于已安装视图，只进行搜索过滤（不过滤状态，因为 API 返回的都是已安装的）
  const filteredExtensions = useMemo(() => {
    if (viewMode === 'installed' || viewMode === 'local') {
      if (!searchQuery) return viewExtensions;
      const query = searchQuery.toLowerCase();
      return viewExtensions.filter(
        (ext) =>
          ext.name.toLowerCase().includes(query) ||
          ext.description.toLowerCase().includes(query) ||
          ext.author?.toLowerCase().includes(query)
      );
    }
    return allFilteredExtensions;
  }, [viewMode, viewExtensions, allFilteredExtensions, searchQuery]);

  // 商店扩展
  const storeExtensions = useStoreExtensions(allExtensionsHook.extensions);

  // 分页
  const { paginatedExtensions, totalPages } = useExtensionPagination(
    filteredExtensions,
    currentPage
  );

  // 统计 - 使用正确的数据源
  // 已安装数量：从已安装扩展数据源获取
  const installedStats = useExtensionStats(installedExtensions);
  // 所有扩展数量：从所有扩展数据源获取
  const allStats = useExtensionStats(allExtensionsHook.extensions);

  // 合并统计信息
  const stats = {
    installedCount: installedStats.installedCount,
    updateCount: installedStats.updateCount,
    availableCount: allStats.availableCount,
  };

  const refreshAfterOperation = async () => {
    await Promise.all([
      refresh(),
      installedExtensionsHook.refresh(),
      localExtensionsHook.refresh(),
    ]);
  };

  // 事件处理（整合所有操作）
  const handlers = useExtensionHandlers({
    extensions: viewExtensions,
    paginatedExtensions,
    onRefresh: refreshAfterOperation,
  });

  // 加载分组数据
  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const data = await listGroups();
      setGroups(data);
    } catch (e) {
      console.error('Failed to load groups:', e);
    } finally {
      setLoadingGroups(false);
    }
  };

  // 当安装弹窗打开时加载分组数据
  useEffect(() => {
    if (handlers.installDialog.installDialogOpen) {
      void loadGroups();
    }
  }, [handlers.installDialog.installDialogOpen]);

  useEffect(() => {
    handlePageChange(1);
  }, [handlePageChange, searchQuery, storeCategory, storePageSize, storeSortBy, viewMode]);

  const handleStoreCategoryChange = (category: string) => {
    setStoreCategory(category);
  };

  const handleStorePageSizeChange = (size: number) => {
    setStorePageSize(size);
  };

  const handleStoreSortChange = (sort: SortOption) => {
    setStoreSortBy(sort);
  };

  const handleImportLocal = async ({
    mode,
    crxPath,
    storeUrl,
  }: {
    mode: 'file' | 'storeUrl';
    crxPath?: string;
    storeUrl?: string;
  }) => {
    try {
      setImportingLocal(true);
      const result =
        mode === 'file'
          ? await importLocalExtensionCrx(crxPath || '')
          : await importLocalExtensionStoreUrl(storeUrl || '');

      if (result.importState === 'imported') {
        await Promise.all([localExtensionsHook.refresh(), installedExtensionsHook.refresh()]);
      }

      setLocalImportDialogOpen(false);

      if (result.importState === 'alreadyInstalled') {
        toast.info(t('dialog.localImport.alreadyInstalled'));
      } else if (result.importState === 'alreadyExists') {
        toast.info(t('dialog.localImport.alreadyExists'));
      } else {
        toast.success(t('dialog.localImport.success'));
      }

      if (viewMode !== 'local') {
        setViewMode('local');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入本地插件失败');
    } finally {
      setImportingLocal(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] relative">
      <ExtensionHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        installedCount={stats.installedCount + stats.updateCount}
      />

      {viewMode === 'installed' ? (
        <>
          <ExtensionStats
            total={stats.installedCount + stats.updateCount}
            installed={stats.installedCount}
            updates={stats.updateCount}
            available={stats.availableCount}
            scopeFilter={scopeFilter}
            onScopeFilterChange={setScopeFilter}
            onRefresh={refresh}
          />

          {error && (
            <div className="px-4 py-2 text-xs text-destructive bg-destructive/10">
              {t('error', { message: error })}
            </div>
          )}

          <ExtensionTable
            extensions={paginatedExtensions}
            selectedIds={handlers.selection.selectedIds}
            onSelect={handlers.selection.select}
            onSelectAll={(selected) => handlers.selection.selectAll(paginatedExtensions, selected)}
            onUpdate={handlers.handleUpdate}
            onUninstall={handlers.handleUninstall}
            onViewDetails={handlers.handleViewDetails}
            onHomepage={handlers.handleHomepage}
            onSecurityCheck={handlers.handleSecurityCheck}
            onDisable={handlers.handleDisable}
            onEnable={handlers.handleEnable}
            loading={loading}
          />

          <ExtensionPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />

          <ExtensionBatchActions
            selectedCount={handlers.selection.selectedIds.size}
            onBatchInstall={() => {}}
            onBatchUpdate={handlers.handleBatchUpdate}
            onBatchUninstall={handlers.handleBatchUninstall}
            onClearSelection={handlers.selection.clearSelection}
          />
        </>
      ) : viewMode === 'store' ? (
        <>
          {error && (
            <div className="px-4 py-2 text-xs text-destructive bg-destructive/10">
              {t('error', { message: error })}
            </div>
          )}

          <ExtensionStore
            extensions={storeExtensions}
            searchQuery={searchQuery}
            totalCount={allExtensionsHook.total}
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(allExtensionsHook.total / storePageSize))}
            pageSize={storePageSize}
            categoryFilter={storeCategory}
            sortBy={storeSortBy}
            onCategoryChange={handleStoreCategoryChange}
            onSortChange={handleStoreSortChange}
            onPageChange={handlePageChange}
            onPageSizeChange={handleStorePageSizeChange}
            onInstall={handlers.handleInstall}
          />
        </>
      ) : (
        <>
          {error && (
            <div className="px-4 py-2 text-xs text-destructive bg-destructive/10">
              {t('error', { message: error })}
            </div>
          )}

          <LocalExtensionLibrary
            extensions={filteredExtensions}
            importing={importingLocal}
            onImport={() => setLocalImportDialogOpen(true)}
            onInstall={(extension) => handlers.handleInstall(extension.id)}
            onDisable={(extension) => handlers.handleDisable(extension.id, extension.name)}
            onEnable={(extension) => handlers.handleEnable(extension.id, extension.name)}
            onRemove={(extension) => handlers.handleRemove(extension.id, extension.name)}
            onViewDetails={(extension) => handlers.handleViewDetails(extension.id)}
          />
        </>
      )}

      {/* 安装对话框 */}
      <ExtensionInstallDialog
        open={handlers.installDialog.installDialogOpen}
        extension={handlers.installDialog.installingExt}
        groups={groups}
        loadingGroups={loadingGroups}
        installGroups={handlers.installDialog.installGroups}
        installForTeam={handlers.installDialog.installForTeam}
        installing={handlers.installing}
        onOpenChange={handlers.installDialog.closeInstallDialog}
        onGroupToggle={handlers.installDialog.toggleInstallGroup}
        onTeamChange={handlers.installDialog.setInstallForTeam}
        onConfirm={handlers.handleConfirmInstall}
      />

      <LocalExtensionImportDialog
        open={localImportDialogOpen}
        importing={importingLocal}
        onOpenChange={setLocalImportDialogOpen}
        onSubmit={handleImportLocal}
      />

      {/* 卸载确认对话框 */}
      <ExtensionUninstallDialog
        open={handlers.uninstallDialog.uninstallDialogOpen}
        extension={handlers.uninstallDialog.uninstallingExt}
        action={handlers.uninstallDialog.action}
        onOpenChange={handlers.uninstallDialog.closeUninstallDialog}
        onConfirm={handlers.handleConfirmUninstall}
      />

      {/* 详情对话框 */}
      <ExtensionDetailDialog
        open={handlers.detailDialog.detailDialogOpen}
        extension={handlers.detailDialog.viewingExtension}
        onOpenChange={handlers.detailDialog.closeDetailDialog}
      />

      {/* 访问主页对话框 */}
      <ExtensionHomepageDialog
        open={handlers.homepageDialog.homepageDialogOpen}
        extension={handlers.homepageDialog.homepageExtension}
        onOpenChange={handlers.homepageDialog.closeHomepageDialog}
      />

      {/* 批量卸载确认对话框 */}
      <ExtensionBatchUninstallDialog
        open={handlers.batchUninstallDialog.batchUninstallDialogOpen}
        count={handlers.selection.selectedIds.size}
        onOpenChange={handlers.batchUninstallDialog.closeBatchUninstallDialog}
        onConfirm={handlers.handleConfirmBatchUninstall}
      />

      {/* 禁用/启用确认对话框 */}
      <ExtensionToggleDialog
        open={handlers.toggleDialog.toggleDialogOpen}
        extension={handlers.toggleDialog.togglingExt}
        action={handlers.toggleDialog.toggleAction}
        onOpenChange={handlers.toggleDialog.closeToggleDialog}
        onConfirm={handlers.handleConfirmToggle}
      />
    </div>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'browser-extensions',
    value: {
      path: '/extensions',
      Component: BrowserExtensionsPage,
    },
    priority: 10,
  });
  console.log('[browser-extensions] Route contributed at module load: /extensions');
} catch (error) {
  console.warn('[browser-extensions] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'browser-extensions',
    value: {
      namespace: 'extensions',
      resources: extensionsResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[browser-extensions] Failed to contribute i18n resources:', error);
}

const browserExtensionsPlugin = {
  id: 'browser-extensions',
  name: 'Browser Extensions',
  version: '1.0.0',
  component: BrowserExtensionsPage,
  slots: [],
};

export default browserExtensionsPlugin;
