import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Network, Zap, Monitor } from 'lucide-react';
// 代理类型定义（从代理中心复制）
interface Proxy {
  id: string;
  name: string;
  host: string;
  port: number;
  type: 'http' | 'https' | 'socks5';
  username?: string;
  password?: string;
  country: string;
  latency: number;
  status: 'healthy' | 'unreachable' | 'testing';
  usageCount: number;
  linkedEnvironments: number;
  createdAt: string;
  lastChecked: string;
}

const API_ENDPOINTS = {
  PROXIES: '/api/v1/proxies',
} as const;

const ITEMS_PER_PAGE = 10;

interface ProxySelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createCount: number;
  onSelect: (proxies: Proxy[]) => void;
}

/**
 * 代理选择对话框组件
 */
export function ProxySelectDialog({
  open,
  onOpenChange,
  createCount,
  onSelect,
}: ProxySelectDialogProps) {
  const { t } = useTranslation('proxy');
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProxyIds, setSelectedProxyIds] = useState<Set<string>>(new Set());

  // 是否支持多选
  const allowMultiple = createCount > 1;

  // 获取代理列表
  const fetchProxies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ENDPOINTS.PROXIES);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = (await res.json()) as { data: Proxy[] };
      setProxies(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchProxies();
      setCurrentPage(1);
      setSelectedProxyIds(new Set());
    }
  }, [open, fetchProxies]);

  // 分页计算
  const totalPages = Math.ceil(proxies.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProxies = proxies.slice(startIndex, endIndex);

  // 格式化日期
  const formatDate = (dateString: string) => {
    if (!dateString || dateString === '-') return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // 获取状态徽章
  const getStatusBadge = (status: Proxy['status']) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {t('status.healthy')}
          </span>
        );
      case 'unreachable':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
            {t('status.unreachable')}
          </span>
        );
      case 'testing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            {t('status.testing')}
          </span>
        );
      default:
        return null;
    }
  };

  // 获取类型徽章
  const getTypeBadge = (type: Proxy['type']) => {
    const colors: Record<string, string> = {
      http: 'bg-blue-500/10 text-blue-500',
      https: 'bg-green-500/10 text-green-500',
      socks5: 'bg-purple-500/10 text-purple-500',
    };
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium uppercase ${colors[type] || 'bg-muted text-muted-foreground'}`}
      >
        {type}
      </span>
    );
  };

  // 获取页码数组
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // 处理选择代理
  const handleSelectProxy = (proxy: Proxy) => {
    if (allowMultiple) {
      // 多选模式：切换选择状态
      const newSelectedIds = new Set(selectedProxyIds);
      if (newSelectedIds.has(proxy.id)) {
        newSelectedIds.delete(proxy.id);
      } else {
        newSelectedIds.add(proxy.id);
      }
      setSelectedProxyIds(newSelectedIds);
    } else {
      // 单选模式：选择新代理时取消之前的选择，只保留当前选择的
      setSelectedProxyIds(new Set([proxy.id]));
    }
  };

  // 处理全选/取消全选
  const handleSelectAll = (selected: boolean) => {
    if (!allowMultiple) return;

    if (selected) {
      const allIds = new Set(proxies.map((p) => p.id));
      setSelectedProxyIds(allIds);
    } else {
      setSelectedProxyIds(new Set());
    }
  };

  // 处理确认选择
  const handleConfirmSelection = () => {
    if (selectedProxyIds.size === 0) return;

    const selectedProxies = proxies.filter((p) => selectedProxyIds.has(p.id));
    onSelect(selectedProxies);
    onOpenChange(false);
  };

  // 计算全选状态
  const allSelected =
    allowMultiple && proxies.length > 0 && proxies.every((proxy) => selectedProxyIds.has(proxy.id));
  const someSelected = allowMultiple && proxies.some((proxy) => selectedProxyIds.has(proxy.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] gap-0 p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-sm font-semibold mb-0">
            {t('dialog.select.title', { defaultValue: '选择代理' })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 h-0 w-full" type="always">
            <div className="min-w-full">
              <table
                className="w-full border-collapse table-auto"
                style={{ minWidth: 'max-content' }}
              >
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 bg-background z-10 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-12">
                      <div className="flex items-center justify-center">
                        {allowMultiple ? (
                          <Checkbox
                            checked={allSelected}
                            ref={(input) => {
                              if (input && 'indeterminate' in input) {
                                (input as HTMLInputElement).indeterminate =
                                  someSelected && !allSelected;
                              }
                            }}
                            onCheckedChange={handleSelectAll}
                            className="h-4 w-4"
                          />
                        ) : (
                          <Checkbox checked={false} disabled className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-56">
                      {t('table.headers.name')}
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-48">
                      {t('table.headers.address')}
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-24">
                      {t('table.headers.type')}
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-20">
                      {t('table.headers.country')}
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-24">
                      {t('table.headers.latency')}
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-24">
                      {t('table.headers.status')}
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-24">
                      {t('table.headers.linkedEnvironments')}
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-24">
                      {t('table.headers.usageCount')}
                    </th>
                    <th className="sticky top-0 bg-background z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-20">
                      {t('table.headers.createdAt')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={10}>
                        {t('table.loading', { defaultValue: '加载中...' })}
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-destructive" colSpan={10}>
                        {error}
                      </td>
                    </tr>
                  ) : paginatedProxies.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={10}>
                        {t('table.empty')}
                      </td>
                    </tr>
                  ) : (
                    paginatedProxies.map((proxy) => (
                      <tr
                        key={proxy.id}
                        className={`group hover:bg-secondary/50 transition-colors cursor-pointer ${
                          selectedProxyIds.has(proxy.id) ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => handleSelectProxy(proxy)}
                      >
                        <td className="sticky left-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-2.5 border-b border-border text-center transition-colors">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={selectedProxyIds.has(proxy.id)}
                              onCheckedChange={() => handleSelectProxy(proxy)}
                              className="h-4 w-4"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          <div className="font-bold flex items-center gap-2">
                            <Network className="h-4 w-4 text-primary" />
                            <span>{proxy.name}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: {proxy.id}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          <div className="font-mono text-[12px]">
                            {proxy.host}:{proxy.port}
                          </div>
                          {proxy.username && (
                            <div className="text-[10px] text-muted-foreground">
                              {t('table.auth')}: {proxy.username}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          {getTypeBadge(proxy.type)}
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          <span className="text-[12px]">{proxy.country}</span>
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          {proxy.status === 'healthy' ? (
                            <div className="flex items-center gap-1 text-[12px]">
                              <Zap className="h-3 w-3 text-emerald-500" />
                              <span className="font-mono">{proxy.latency} ms</span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          {getStatusBadge(proxy.status)}
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          <div className="flex items-center gap-1.5">
                            <Monitor className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-[12px] text-foreground">
                              {proxy.linkedEnvironments}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          <span className="font-mono text-[12px] text-muted-foreground">
                            {proxy.usageCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 border-b border-border text-[13px]">
                          <div className="text-[12px] text-muted-foreground">
                            {formatDate(proxy.createdAt)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* 确认选择按钮 */}
          {selectedProxyIds.size > 0 && (
            <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/50">
              <div className="text-xs text-muted-foreground">
                {allowMultiple ? `已选择 ${selectedProxyIds.size} 个代理` : '已选择 1 个代理'}
              </div>
              <div className="flex items-center gap-2">
                {allowMultiple && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] px-3 py-1.5 h-7"
                    onClick={() => setSelectedProxyIds(new Set())}
                  >
                    清空
                  </Button>
                )}
                <Button
                  size="sm"
                  className="text-[10px] px-3 py-1.5 h-7"
                  onClick={handleConfirmSelection}
                >
                  确认选择
                </Button>
              </div>
            </div>
          )}

          {/* 分页 */}
          {!loading && !error && proxies.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {t('pagination.pageInfo', { currentPage, totalPages })}
              </div>
              <Pagination className="flex justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className={
                        currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                      }
                    >
                      {t('pagination.previous')}
                    </PaginationPrevious>
                  </PaginationItem>

                  {getPageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === 'ellipsis' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={page === currentPage}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }}
                      className={
                        currentPage === totalPages
                          ? 'pointer-events-none opacity-50'
                          : 'cursor-pointer'
                      }
                    >
                      {t('pagination.next')}
                    </PaginationNext>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
