import { useState, useEffect, useCallback } from 'react';
import { extensionRegistry } from '@slotkitjs/core';
import { useTranslation } from 'react-i18next';
import { proxyResources } from './i18n/resources';
import { ProxyHeader } from './components/proxy-header';
import { ProxyStats } from './components/proxy-stats';
import { ProxyTable } from './components/proxy-table';
import { ProxyBatchActions } from './components/proxy-batch-actions';
import { ProxyPagination } from './components/proxy-pagination';
import { ProxyCreateDialog } from './components/proxy-create-dialog';
import { ProxyEditDialog } from './components/proxy-edit-dialog';
import { ProxyDeleteDialog } from './components/proxy-delete-dialog';
import { ProxyBatchDeleteDialog } from './components/proxy-batch-delete-dialog';
import { ProxyImportDrawer } from './components/proxy-import-drawer';
import { ProxyExportDialog } from './components/proxy-export-dialog';
import { ProxyChainPanel } from './components/proxy-chain-panel';
import { useProxies } from './hooks/use-proxies';
import { useProxyStats } from './hooks/use-proxy-stats';
import { useSearchPagination } from './hooks/use-search-pagination';
import { useProxyHandlers } from './hooks/use-proxy-handlers';
import { selectAndReadProxyFile, type ImportProxyItem } from './utils/import-export';
import type { Proxy } from './types';
import { ITEMS_PER_PAGE } from './constants';

const ProxyCenterPage: React.FC = () => {
  useTranslation('proxy'); // 注册 i18n namespace
  const [activeView, setActiveView] = useState<'proxies' | 'chain'>('proxies');

  // 搜索和分页
  const {
    searchQuery,
    proxyType,
    currentPage,
    handleSearchChange,
    handleProxyTypeChange,
    handlePageChange,
  } = useSearchPagination();

  // 数据获取
  const {
    proxies: fetchedProxies,
    total,
    totalPages,
    loading,
    error,
    refresh,
  } = useProxies({
    page: currentPage,
    pageSize: ITEMS_PER_PAGE,
    searchQuery,
    proxyType,
  });
  
  // 客户端代理状态管理（用于更新测试后的数据）
  const [allProxies, setAllProxies] = useState(fetchedProxies);
  
  // 测试状态管理（用于显示加载动画）
  const [testingProxies, setTestingProxies] = useState<Set<string>>(new Set());
  
  // 同步 fetchedProxies 到 allProxies
  useEffect(() => {
    setAllProxies(fetchedProxies);
  }, [fetchedProxies]);

  useEffect(() => {
    if (currentPage > totalPages) {
      handlePageChange(totalPages);
    }
  }, [currentPage, handlePageChange, totalPages]);

  // 统计
  const stats = useProxyStats(allProxies);

  // 事件处理（整合所有操作）
  const handlers = useProxyHandlers({
    proxies: allProxies,
    paginatedProxies: allProxies,
    filteredProxies: allProxies,
    onRefresh: refresh,
  });

  // 导入抽屉状态
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [importItems, setImportItems] = useState<ImportProxyItem[]>([]);

  // 导出对话框状态
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { clearSelection } = handlers.selection;

  // 当分页变化时，清除选择
  const handlePageChangeWithClearSelection = useCallback((page: number) => {
    handlePageChange(page);
    clearSelection();
  }, [clearSelection, handlePageChange]);

  const handleSearchChangeWithClearSelection = useCallback((value: string) => {
    handleSearchChange(value);
    clearSelection();
  }, [clearSelection, handleSearchChange]);

  const handleProxyTypeChangeWithClearSelection = useCallback((value: string) => {
    handleProxyTypeChange(value);
    clearSelection();
  }, [clearSelection, handleProxyTypeChange]);

  // 处理导出：打开确认对话框
  const handleExport = () => {
    setExportDialogOpen(true);
  };

  // 计算要导出的代理列表
  const proxiesToExport =
      handlers.selection.selectedIds.size > 0
        ? allProxies.filter((p) => handlers.selection.selectedIds.has(p.uuid))
        : allProxies;

  // 处理导入：选择文件后打开抽屉（支持 CSV 和 JSON）
  const handleImport = async () => {
    const items = await selectAndReadProxyFile();
    if (items && items.length > 0) {
      setImportItems(items);
      setImportDrawerOpen(true);
    }
  };

  // 包装测试代理函数，更新本地状态
  const handleTestProxyWrapper = async (proxy: Proxy) => {
    // 设置测试中状态
    setTestingProxies(prev => new Set(prev).add(proxy.uuid));
    
    const updatedProxy = await handlers.operations.testProxy(proxy);
    
    // 移除测试中状态
    setTestingProxies(prev => {
      const newSet = new Set(prev);
      newSet.delete(proxy.uuid);
      return newSet;
    });
    
    if (updatedProxy) {
      setAllProxies(prev => prev.map(p => p.uuid === updatedProxy.uuid ? updatedProxy : p));
    }
  };

  // 包装批量测试函数
  const handleBatchTestWrapper = async () => {
    const selectedProxies = allProxies.filter(p => handlers.selection.selectedIds.has(p.uuid));
    for (const proxy of selectedProxies) {
      // 设置测试中状态
      setTestingProxies(prev => new Set(prev).add(proxy.uuid));
      
      const updatedProxy = await handlers.operations.testProxy(proxy);
      
      // 移除测试中状态
      setTestingProxies(prev => {
        const newSet = new Set(prev);
        newSet.delete(proxy.uuid);
        return newSet;
      });
      
      if (updatedProxy) {
        setAllProxies(prev => prev.map(p => p.uuid === updatedProxy.uuid ? updatedProxy : p));
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] relative">
      <div className="px-6 py-3 border-b border-border flex items-center gap-2 bg-background">
        <button
          type="button"
          onClick={() => setActiveView('proxies')}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            activeView === 'proxies'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          代理列表
        </button>
        <button
          type="button"
          onClick={() => setActiveView('chain')}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            activeView === 'chain'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          链式代理
        </button>
      </div>

      {activeView === 'chain' ? (
        <ProxyChainPanel />
      ) : (
        <>
      <ProxyHeader
        onSearchChange={handleSearchChangeWithClearSelection}
        onCreateNew={handlers.handleCreateProxy}
        onImport={handleImport}
        onExport={handleExport}
      />

      <ProxyStats
        total={total}
        healthy={stats.healthy}
        unreachable={stats.unreachable}
        selectedCount={handlers.selection.selectedIds.size}
        onTestSelected={handleBatchTestWrapper}
      />

      {error && <div className="px-6 py-2 text-xs text-destructive">代理列表加载失败：{error}</div>}

      <ProxyTable
        proxies={allProxies}
        proxyTypeFilter={proxyType}
        onProxyTypeFilterChange={handleProxyTypeChangeWithClearSelection}
        selectedIds={handlers.selection.selectedIds}
        testingIds={testingProxies}
        onSelect={handlers.selection.select}
        onSelectAll={(selected) => handlers.selection.selectAll(allProxies, selected)}
        onTest={handleTestProxyWrapper}
        onEdit={handlers.handleEditProxy}
        onDelete={handlers.handleDeleteProxy}
        loading={loading}
      />

      <ProxyPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChangeWithClearSelection}
      />

      <ProxyBatchActions
        selectedCount={handlers.selection.selectedIds.size}
        onClear={handlers.selection.clearSelection}
        onTestSelected={handleBatchTestWrapper}
        onDelete={handlers.handleBatchDelete}
      />

      {/* 创建代理对话框 */}
      <ProxyCreateDialog
        open={handlers.createDialogOpen}
        formData={handlers.newProxy}
        submitting={handlers.operations.submitting}
        onOpenChange={handlers.setCreateDialogOpen}
        onFormDataChange={handlers.setNewProxy}
        onSubmit={handlers.handleSubmitCreate}
      />

      {/* 编辑代理对话框 */}
      <ProxyEditDialog
        open={handlers.editDialogOpen}
        proxy={handlers.editingProxy}
        formData={handlers.editProxy}
        submitting={handlers.operations.submitting}
        onOpenChange={handlers.setEditDialogOpen}
        onFormDataChange={handlers.setEditProxy}
        onSubmit={handlers.handleSubmitEdit}
      />

      {/* 删除代理确认对话框 */}
      <ProxyDeleteDialog
        open={handlers.deleteDialogOpen}
        proxy={handlers.deletingProxy}
        onOpenChange={handlers.setDeleteDialogOpen}
        onConfirm={handlers.handleConfirmDelete}
      />

      {/* 批量删除确认对话框 */}
      <ProxyBatchDeleteDialog
        open={handlers.batchDeleteDialogOpen}
        count={handlers.selection.selectedIds.size}
        onOpenChange={handlers.setBatchDeleteDialogOpen}
        onConfirm={handlers.handleConfirmBatchDelete}
      />

      {/* 导入代理抽屉 */}
      <ProxyImportDrawer
        open={importDrawerOpen}
        items={importItems}
        onOpenChange={setImportDrawerOpen}
        onComplete={refresh}
      />

      {/* 导出代理确认对话框 */}
      <ProxyExportDialog
        open={exportDialogOpen}
        proxies={proxiesToExport}
        onOpenChange={setExportDialogOpen}
      />
        </>
      )}
    </div>
  );
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'proxy-center',
    value: {
      path: '/proxy',
      Component: ProxyCenterPage,
    },
    priority: 10,
  });
  console.log('[proxy-center] Route contributed at module load: /proxy');
} catch (error) {
  console.warn('[proxy-center] Failed to contribute route at module load:', error);
}

try {
  extensionRegistry.contribute('i18n:resources', {
    contributorId: 'proxy-center',
    value: {
      namespace: 'proxy',
      resources: proxyResources,
    },
    priority: 10,
  });
} catch (error) {
  console.warn('[proxy-center] Failed to contribute i18n resources:', error);
}

const proxyCenterPlugin = {
  id: 'proxy-center',
  name: 'Proxy Center',
  version: '1.0.0',
  component: ProxyCenterPage,
  slots: [],
};

export default proxyCenterPlugin;
