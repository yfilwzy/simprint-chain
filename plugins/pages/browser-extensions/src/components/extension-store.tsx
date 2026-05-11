import { useTranslation } from 'react-i18next';
import { Download, CheckCircle2, Star, Users, ArrowUpDown, SearchX } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { StoreExtension, SortOption } from '../types';
import { STORE_PAGE_SIZE_OPTIONS } from '../constants';
import { ExtensionIcon } from './extension-icon';

export type { StoreExtension };

interface ExtensionStoreProps {
  extensions: StoreExtension[];
  searchQuery: string;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  categoryFilter: string;
  sortBy: SortOption;
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: SortOption) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onInstall: (id: string) => void;
}

// 分类颜色配置
const categoryStyles: Record<string, string> = {
  automation: 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  security: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  productivity: 'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  tools: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  media: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  social: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

// 格式化下载量
function formatDownloads(downloads: number | undefined): string {
  if (!downloads) return '0';
  if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`;
  if (downloads >= 1000) return `${(downloads / 1000).toFixed(0)}K`;
  return downloads.toString();
}

function ExtensionCard({
  extension,
  onInstall,
}: {
  extension: StoreExtension;
  onInstall: (id: string) => void;
}) {
  const { t } = useTranslation('extensions');
  const isInstalled = extension.status === 'installed' || extension.status === 'update';

  const categoryBadge = extension.category ? (
    <span
      className={`text-[9px] font-semibold uppercase tracking-wide border rounded px-1.5 py-0.5 ${categoryStyles[extension.category] || 'border-muted bg-muted/50 text-muted-foreground'}`}
    >
      {t(`store.categories.${extension.category}`)}
    </span>
  ) : null;

  return (
    <div className="group relative bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
      {/* 头部：图标 + 名称 + 分类 */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
          <ExtensionIcon
            icon={extension.icon}
            source={extension.source}
            containerClassName="h-9 w-9 rounded-md"
            imageClassName="rounded-md"
            fallbackClassName="h-6 w-6"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-[13px] text-foreground truncate">{extension.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground/70">
              v{extension.version}
            </span>
            {categoryBadge}
          </div>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mb-3 min-h-[32px] leading-relaxed">
        {extension.description}
      </p>

      {/* 统计信息 */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70 mb-3">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" />
          {formatDownloads(extension.downloads)}
        </span>
        {extension.rating && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            {extension.rating.toFixed(1)}
          </span>
        )}
        {extension.author && (
          <span className="ml-auto truncate max-w-[100px]">{extension.author}</span>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end pt-3 border-t border-border/40">
        {isInstalled ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('store.installed')}
          </span>
        ) : (
          <Button
            size="sm"
            className="h-7 px-3 text-[11px] rounded-md"
            onClick={() => onInstall(extension.id)}
          >
            <Download className="h-3 w-3 mr-1.5" />
            {t('store.install')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ExtensionStore({
  extensions,
  searchQuery,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  categoryFilter,
  sortBy,
  onCategoryChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onInstall,
}: ExtensionStoreProps) {
  const { t } = useTranslation('extensions');

  const categories = [
    { value: 'all', label: t('store.categories.all') },
    { value: 'automation', label: t('store.categories.automation') },
    { value: 'security', label: t('store.categories.security') },
    { value: 'productivity', label: t('store.categories.productivity') },
    { value: 'tools', label: t('store.categories.tools') },
    { value: 'media', label: t('store.categories.media') },
    { value: 'social', label: t('store.categories.social') },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'downloads', label: t('store.sort.downloads') },
    { value: 'rating', label: t('store.sort.rating') },
    { value: 'name', label: t('store.sort.name') },
    { value: 'newest', label: t('store.sort.newest') },
  ];

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

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 筛选栏 */}
      <div className="shrink-0 min-h-14 px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-4">
        {/* 分类筛选 */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className={`h-8 px-4 text-[11px] font-medium rounded-md whitespace-nowrap transition-all border inline-flex items-center justify-center ${
                categoryFilter === cat.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 右侧：排序 + 统计 */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="data-[size=default]:h-8 w-[110px] text-[11px] bg-background border-border">
              <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {totalCount > 0 && (
            <span className="h-8 inline-flex items-center text-[11px] text-muted-foreground bg-background border border-border rounded-md px-4">
              {t('store.totalExtensions', { count: totalCount })}
            </span>
          )}
        </div>
      </div>

      {/* 插件卡片列表 - 可滚动区域 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {extensions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <SearchX className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">{t('store.noResults')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery ? t('store.noResultsHint') : t('store.noResultsHint')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {extensions.map((ext) => (
                <ExtensionCard key={ext.id} extension={ext} onInstall={onInstall} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 分页 - 固定在底部 */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-border bg-background/10 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {t('store.pageInfo', { currentPage, totalPages })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {t('store.pageSize')}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger size="sm" className="h-7 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORE_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {t('store.totalItems', { total: totalCount })}
            </span>
          </div>
        </div>
        <Pagination className="flex justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) onPageChange(currentPage - 1);
                }}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
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
                      onPageChange(page);
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
                  if (currentPage < totalPages) onPageChange(currentPage + 1);
                }}
                className={
                  currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                }
              >
                {t('pagination.next')}
              </PaginationNext>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
