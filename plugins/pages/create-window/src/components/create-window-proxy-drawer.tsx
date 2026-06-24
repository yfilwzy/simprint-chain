import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri';
import {
  Loader2,
  Check,
  Plus,
  Search,
  Globe,
  Zap,
  Shield,
  WifiOff,
  Server,
  X,
  Activity,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type ColumnDef } from '@/components/data-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
// @ts-ignore - Cross-plugin import
import {
  listProxies,
  createProxy,
  deleteProxy,
  type ProxyItem,
} from '../../../environment-manager/src/api';
import { CreateWindowCreateProxyDialog } from './create-window-create-proxy-dialog';

interface CreateWindowProxyDrawerProps {
  open: boolean;
  selectedProxyUuids: string[]; // 已选中的代理 UUID 列表
  maxCount?: number; // 最大选择数量（用于限制）
  onOpenChange: (open: boolean) => void;
  onConfirm: (proxyUuids: string[]) => void; // 返回选中的代理 UUID 列表
}

/**
 * 获取代理类型图标
 */
const getProxyTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'socks5':
      return Shield;
    case 'ssh':
      return Server;
    default:
      return Globe;
  }
};

/**
 * 客户端代理检测状态
 */
type ProxyTestStatus = 'untested' | 'testing' | 'healthy' | 'unhealthy';

interface ProxyTestResult {
  status: ProxyTestStatus;
  ip?: string;
  country?: string;
  country_code?: string;
  latency?: number;
  error?: string;
}

/**
 * 获取状态样式
 */
const getStatusStyle = (status: ProxyTestStatus, t: (key: string) => string) => {
  switch (status) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-600 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: t('dialog.proxy.statusHealthy') || '健康',
      };
    case 'unhealthy':
      return {
        bg: 'bg-red-500/15',
        text: 'text-red-600 dark:text-red-400',
        dot: 'bg-red-500',
        label: t('dialog.proxy.statusUnhealthy') || '不可用',
      };
    case 'testing':
      return {
        bg: 'bg-blue-500/15',
        text: 'text-blue-600 dark:text-blue-400',
        dot: 'bg-blue-500 animate-pulse',
        label: t('dialog.proxy.statusTesting') || '检测中',
      };
    default: // untested
      return {
        bg: 'bg-gray-500/15',
        text: 'text-gray-500',
        dot: 'bg-gray-400',
        label: t('dialog.proxy.statusUntested') || '未检测',
      };
  }
};

const getProxyInfoText = (proxy: ProxyItem) => {
  return `${proxy.host}:${proxy.port}`;
};

const getProxyCategoryText = (proxy: ProxyItem) => {
  return (proxy.proxy_type || '-').toUpperCase();
};

const getProxyRemarkText = (proxy: ProxyItem) => {
  if (proxy.remark) return proxy.remark;
  if (proxy.country && proxy.city) return `${proxy.country} · ${proxy.city}`;
  if (proxy.country) return proxy.country;
  if (proxy.city) return proxy.city;
  return '-';
};

const getAssociatedText = (proxy: ProxyItem) => {
  if (typeof proxy.environments_count === 'number') return String(proxy.environments_count);
  return '-';
};

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  t: (key: string) => string;
}> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <WifiOff className="h-8 w-8 text-blue-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">
      {t('dialog.proxy.noProxies') || '暂无代理'}
    </h4>
    <p className="text-xs text-muted-foreground text-center max-w-[240px]">
      {t('dialog.proxy.noProxiesDescription') || '创建代理以保护您的环境隐私并隐藏您的真实 IP 地址'}
    </p>
  </div>
);

/**
 * 创建窗口代理设置抽屉
 */
export function CreateWindowProxyDrawer({
  open,
  selectedProxyUuids: initialSelectedProxyUuids,
  maxCount,
  onOpenChange,
  onConfirm,
}: CreateWindowProxyDrawerProps) {
  const { t } = useTranslation('create-window');

  // 代理列表
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [loadingProxies, setLoadingProxies] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 客户端检测状态管理（key: proxy.uuid, value: 检测结果）
  const [proxyTestResults, setProxyTestResults] = useState<Map<string, ProxyTestResult>>(new Map());

  // 选中的代理 UUID（使用 Set 以匹配 DataTable）
  const [selectedProxyUuids, setSelectedProxyUuids] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // 创建代理对话框状态
  const [createProxyDialogOpen, setCreateProxyDialogOpen] = useState(false);

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proxyToDelete, setProxyToDelete] = useState<ProxyItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 过滤后的代理列表
  const filteredProxies = useMemo(() => {
    if (!searchQuery.trim()) return proxies;
    const query = searchQuery.toLowerCase();
    return proxies.filter(
      (proxy) =>
        proxy.name.toLowerCase().includes(query) ||
        proxy.host.toLowerCase().includes(query) ||
        proxy.proxy_type.toLowerCase().includes(query) ||
        proxy.country?.toLowerCase().includes(query)
    );
  }, [proxies, searchQuery]);

  const totalPages = useMemo(() => {
    const total = filteredProxies.length;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [filteredProxies.length, pageSize]);

  const currentPage = Math.min(page, totalPages);

  const pagedProxies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProxies.slice(start, start + pageSize);
  }, [filteredProxies, currentPage, pageSize]);

  // 加载代理列表
  useEffect(() => {
    if (open) {
      loadProxies();
      setSearchQuery('');
      setPage(1);
      // 初始化已选中的代理
      setSelectedProxyUuids(new Set(initialSelectedProxyUuids || []));
    }
  }, [open, initialSelectedProxyUuids]);

  const loadProxies = async () => {
    setLoadingProxies(true);
    try {
      const list = await listProxies();
      setProxies(list);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('dialog.proxy.loadFailed') || '加载代理列表失败'
      );
    } finally {
      setLoadingProxies(false);
    }
  };

  // 打开创建代理弹窗
  const handleOpenCreateProxy = () => {
    setCreateProxyDialogOpen(true);
  };

  // 代理创建完成后的回调
  const handleProxyCreated = () => {
    loadProxies(); // 重新加载代理列表
  };

  // 确认选择
  const handleConfirm = () => {
    const selected = Array.from(selectedProxyUuids);
    onConfirm(selected);
    onOpenChange(false);
  };

  // 测试单个代理
  const handleTestProxy = async (proxy: ProxyItem) => {
    // 设置为检测中状态
    setProxyTestResults(prev => new Map(prev).set(proxy.uuid, { status: 'testing' }));

    try {
      const result = await invoke<{
        success: boolean;
        ip_info?: { ip: string; country: string; country_code: string };
        latency_ms?: number;
        error?: string;
      }>('test_proxy', {
        config: {
          proxy_type: proxy.proxy_type,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username || null,
          password: proxy.password
            ? { value: proxy.password, encrypted: false }
            : null,
        },
      });

      if (result.success && result.ip_info) {
        // 更新为健康状态
        setProxyTestResults(prev => new Map(prev).set(proxy.uuid, {
          status: 'healthy',
          ip: result.ip_info!.ip,
          country: result.ip_info!.country,
          country_code: result.ip_info!.country_code,
          latency: result.latency_ms,
        }));
      } else {
        // 更新为不健康状态
        setProxyTestResults(prev => new Map(prev).set(proxy.uuid, {
          status: 'unhealthy',
          error: result.error || '连接失败',
        }));
      }
    } catch (e) {
      // 更新为不健康状态
      const errorMsg = e instanceof Error ? e.message : String(e);
      setProxyTestResults(prev => new Map(prev).set(proxy.uuid, {
        status: 'unhealthy',
        error: errorMsg,
      }));
    }
  };

  // 批量测试选中的代理
  const [testingSelected, setTestingSelected] = useState(false);
  const handleTestSelected = async () => {
    if (selectedProxyUuids.size === 0) return;
    const selectedProxies = proxies.filter(p => selectedProxyUuids.has(p.uuid));
    if (selectedProxies.length === 0) return;

    setTestingSelected(true);
    
    for (const proxy of selectedProxies) {
      await handleTestProxy(proxy);
    }
    
    setTestingSelected(false);
  };

  // 打开删除确认对话框
  const handleDeleteProxy = (proxy: ProxyItem) => {
    setProxyToDelete(proxy);
    setDeleteDialogOpen(true);
  };

  // 确认删除代理
  const handleConfirmDelete = async () => {
    if (!proxyToDelete) return;

    setDeleting(true);
    try {
      await deleteProxy({ uuid: proxyToDelete.uuid });
      toast.success(t('dialog.proxy.deleteSuccess') || '删除代理成功');
      // 从列表中移除已删除的代理
      setProxies((prev) => prev.filter((p) => p.uuid !== proxyToDelete.uuid));
      // 如果删除的代理在选中列表中，也要移除
      const newSelected = new Set(selectedProxyUuids);
      newSelected.delete(proxyToDelete.uuid);
      setSelectedProxyUuids(newSelected);
      setDeleteDialogOpen(false);
      setProxyToDelete(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('dialog.proxy.deleteFailed') || '删除代理失败'
      );
    } finally {
      setDeleting(false);
    }
  };

  // 定义列配置
  const columns: ColumnDef<ProxyItem>[] = useMemo(
    () => [
      {
        id: 'info',
        header: t('dialog.proxy.tableHeaderInfo') || '代理信息',
        cell: ({ row }) => {
          // 使用本地检测状态，默认为未检测
          const testResult = proxyTestResults.get(row.uuid);
          const status: ProxyTestStatus = testResult?.status || 'untested';
          const statusStyle = getStatusStyle(status, t);
          
          return (
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground font-mono truncate">
                {getProxyInfoText(row)}
              </div>
              <span
                className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                {statusStyle.label}
                {testResult?.latency && (
                  <span className="ml-1">{testResult.latency}ms</span>
                )}
              </span>
              {testResult?.status === 'healthy' && testResult.country && testResult.country_code && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {testResult.country_code} | {testResult.country}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'category',
        header: t('dialog.proxy.tableHeaderCategory') || '分类',
        width: 96,
        cell: ({ row }) => (
          <span className="text-[10px] font-semibold text-muted-foreground">
            {getProxyCategoryText(row)}
          </span>
        ),
      },
      {
        id: 'associated',
        header: t('dialog.proxy.tableHeaderAssociated') || '关联环境',
        width: 96,
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-mono">{getAssociatedText(row)}</span>
        ),
      },
      {
        id: 'actions',
        header: t('dialog.proxy.tableHeaderActions') || '操作',
        width: 112,
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                void handleTestProxy(row);
              }}
              disabled={proxyTestResults.get(row.uuid)?.status === 'testing'}
              title={t('dialog.proxy.testButton') || '检测'}
            >
              {proxyTestResults.get(row.uuid)?.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                void handleDeleteProxy(row);
              }}
              title={t('dialog.proxy.delete') || '删除'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, proxyTestResults]
  );

  const renderPageItems = () => {
    const max = totalPages;
    const p = currentPage;
    const pages: (number | 'ellipsis')[] = [];
    if (max <= 7) {
      for (let i = 1; i <= max; i++) pages.push(i);
    } else {
      pages.push(1);
      const left = Math.max(2, p - 1);
      const right = Math.min(max - 1, p + 1);
      if (left > 2) pages.push('ellipsis');
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < max - 1) pages.push('ellipsis');
      pages.push(max);
    }

    return pages.map((it, idx) => {
      if (it === 'ellipsis') {
        return (
          <PaginationItem key={`e-${idx}`}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      const pageNum = it;
      return (
        <PaginationItem key={pageNum}>
          <PaginationLink
            href="#"
            isActive={pageNum === currentPage}
            size="sm"
            className="h-7 w-7 text-xs"
            onClick={(e) => {
              e.preventDefault();
              setPage(pageNum);
            }}
          >
            {pageNum}
          </PaginationLink>
        </PaginationItem>
      );
    });
  };

  return (
    <>
      <Drawer open={open} direction="right" onOpenChange={onOpenChange}>
        <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-[48vw] my-auto mr-4 rounded-md max-w-[1100px] h-[96%] gap-0 p-0 overflow-hidden flex flex-col">
          {/* 渐变头部 */}
          <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
            <DrawerHeader className="space-y-1 p-0">
              <DrawerTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                {t('dialog.proxy.title') || '代理设置'}
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                {t('dialog.proxy.selectDescription') || '选择或创建代理'}
              </DrawerDescription>
            </DrawerHeader>
          </div>

          {/* 内容区域 */}
          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* 工具栏：搜索（左上角）+ 创建代理（右上角） */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative group w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder={t('dialog.proxy.searchPlaceholder') || '搜索代理名称、IP 或类型...'}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-8 h-9 text-sm bg-muted/30 border-border/50 rounded-lg focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleOpenCreateProxy}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {t('dialog.proxy.createNew') || '新建代理'}
              </Button>
            </div>

            {/* 表格区域 */}
            <div className="rounded-lg border border-border/50 overflow-hidden flex flex-col flex-1 min-h-0">
              {proxies.length === 0 && !loadingProxies ? (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState t={t} />
                </div>
              ) : (
                <DataTable
                  data={pagedProxies}
                  columns={columns}
                  getRowKey={(row) => row.uuid}
                  loading={loadingProxies}
                  skeletonRows={pageSize}
                  emptyText={
                    filteredProxies.length === 0
                      ? t('dialog.proxy.noMatch') || '未找到匹配的代理'
                      : t('dialog.proxy.noProxies') || '暂无代理'
                  }
                  selectable={true}
                  selectedIds={selectedProxyUuids}
                  onSelectionChange={(newSelected) => {
                    // 处理数量限制
                    if (maxCount === 1) {
                      // 数量为1时，只保留最后一个
                      if (newSelected.size > 1) {
                        const lastSelected = Array.from(newSelected).pop();
                        setSelectedProxyUuids(new Set(lastSelected ? [lastSelected] : []));
                      } else {
                        setSelectedProxyUuids(newSelected);
                      }
                    } else if (maxCount && maxCount > 1) {
                      // 数量大于1时，检查是否超过限制
                      if (newSelected.size > maxCount) {
                        toast.error(
                          t('dialog.proxy.maxCountExceeded') ||
                            `代理数量不可以超出实际创建的窗口数量（${maxCount}）`
                        );
                        // 限制到最大数量
                        const limited = Array.from(newSelected).slice(0, maxCount);
                        setSelectedProxyUuids(new Set(limited));
                      } else {
                        setSelectedProxyUuids(newSelected);
                      }
                    } else {
                      // 没有限制时，直接设置
                      setSelectedProxyUuids(newSelected);
                    }
                  }}
                  onRowClick={(row) => {
                    const newSelected = new Set(selectedProxyUuids);
                    if (newSelected.has(row.uuid)) {
                      // 取消选择
                      newSelected.delete(row.uuid);
                      setSelectedProxyUuids(newSelected);
                    } else {
                      // 选择新代理
                      if (maxCount === 1) {
                        // 数量为1时，取消已选择的，选择新的
                        setSelectedProxyUuids(new Set([row.uuid]));
                      } else if (maxCount && maxCount > 1) {
                        // 数量大于1时，检查是否超过限制
                        if (newSelected.size >= maxCount) {
                          toast.error(
                            t('dialog.proxy.maxCountExceeded') ||
                              `代理数量不可以超出实际创建的窗口数量（${maxCount}）`
                          );
                          return;
                        }
                        newSelected.add(row.uuid);
                        setSelectedProxyUuids(newSelected);
                      } else {
                        // 没有限制时，直接添加
                        newSelected.add(row.uuid);
                        setSelectedProxyUuids(newSelected);
                      }
                    }
                  }}
                  stickyRightColumns={['actions']}
                  className="m-0 border-0 rounded-none flex-1 min-h-0 [&_td]:py-2 [&_th]:py-3 [&_tbody_tr:last-child]:border-b-0 [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_td:first-child]:border-b-0"
                  tableClassName="min-w-full"
                />
              )}
            </div>

            {/* 分页：底部 */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border border-border/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t('dialog.proxy.total') || '共'}{' '}
                  <span className="font-medium text-foreground">{filteredProxies.length}</span>{' '}
                  {t('dialog.proxy.items') || '项'}
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-[86px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {t('dialog.proxy.itemsPerPage') || '项/页'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.max(1, p - 1));
                      }}
                      aria-label={t('dialog.proxy.previous') || '上一页'}
                      aria-disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">
                        {t('dialog.proxy.previous') || '上一页'}
                      </span>
                    </PaginationLink>
                  </PaginationItem>
                  {renderPageItems()}
                  <PaginationItem>
                    <PaginationLink
                      href="#"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.min(totalPages, p + 1));
                      }}
                      aria-label={t('dialog.proxy.next') || '下一页'}
                      aria-disabled={currentPage === totalPages}
                    >
                      <span className="hidden sm:inline">{t('dialog.proxy.next') || '下一页'}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </PaginationLink>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>

          {/* 底部操作栏 */}
          <DrawerFooter className="px-5 py-3 bg-muted/30 border-t border-border/50 gap-2 flex-row items-center justify-end">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onOpenChange(false)}
              >
                {t('dialog.proxy.cancel') || '取消'}
              </Button>
              <Button
                size="sm"
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                onClick={handleConfirm}
                disabled={submitting || selectedProxyUuids.size === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {t('dialog.proxy.saving') || '保存中...'}
                  </>
                ) : (
                  t('dialog.proxy.confirm') || '确认'
                )}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 创建代理对话框 */}
      <CreateWindowCreateProxyDialog
        open={createProxyDialogOpen}
        onOpenChange={setCreateProxyDialogOpen}
        onComplete={handleProxyCreated}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="gap-0 p-3">
          <AlertDialogHeader className="mb-3">
            <AlertDialogTitle className="text-sm font-semibold mb-0 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t('dialog.proxy.deleteTitle') || '删除代理'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[10px] text-muted-foreground mt-0.5 mb-0">
              {proxyToDelete &&
                (t('dialog.proxy.deleteDescription', {
                  name: proxyToDelete.name || `${proxyToDelete.host}:${proxyToDelete.port}`,
                }) ||
                  `确定要删除代理 "${proxyToDelete.name || `${proxyToDelete.host}:${proxyToDelete.port}`}" 吗？`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert className="border-destructive/50 bg-destructive/10 mb-3 px-3 py-2">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <AlertTitle className="text-[10px] text-destructive">
              {t('dialog.proxy.deleteWarningTitle') || '警告'}
            </AlertTitle>
            <AlertDescription className="text-[10px] text-destructive/90">
              {t('dialog.proxy.deleteWarningDescription') ||
                '删除代理后，使用该代理的环境将无法继续使用该代理。此操作不可恢复。'}
            </AlertDescription>
          </Alert>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setProxyToDelete(null);
              }}
              className="text-[10px] px-3 py-1.5 h-7"
              disabled={deleting}
            >
              {t('dialog.proxy.deleteCancel') || '取消'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[10px] px-3 py-1.5 h-7"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  {t('dialog.proxy.deleting') || '删除中...'}
                </>
              ) : (
                t('dialog.proxy.deleteConfirm') || '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
