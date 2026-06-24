import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, RefreshCw, ChevronDown, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ReferralPagination } from './referral-pagination';
import { ReferralTableSkeleton } from './referral-table-skeleton';
import type { ReferredUser, UserStatusFilter, ReferralLink } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface UsersTabProps {
  users: ReferredUser[];
  loading: boolean;
  totalPages: number;
  currentPage: number;
  statusFilter: UserStatusFilter;
  searchQuery: string;
  links: ReferralLink[];
  onRefresh: () => Promise<void>;
  onPageChange: (page: number) => void;
  onStatusFilterChange: (filter: UserStatusFilter) => void;
  onSearchChange: (query: string) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({
  users,
  loading,
  totalPages,
  currentPage,
  statusFilter,
  searchQuery,
  links,
  onRefresh,
  onPageChange,
  onStatusFilterChange,
  onSearchChange,
}) => {
  const { t } = useTranslation('referral');
  const [searchValue, setSearchValue] = useState(searchQuery);
  const searchChangeRef = useRef(onSearchChange);

  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchChangeRef.current(searchValue);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchValue]);

  const formatMoney = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : '--';
  };

  const getLinkDisplayName = (linkId: string) => {
    const linkIndex = links.findIndex((link) => link.id === linkId);
    if (linkIndex < 0) return '-';

    const link = links[linkIndex];
    return link.name || t('overview.linkFallback', { index: linkIndex + 1 });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-50px)]">
      {/* 顶部搜索和筛选栏 */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background z-10">
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('users.searchPlaceholder')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-9 w-72 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void onRefresh()}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 hover:bg-primary/90 transition-colors border border-primary rounded-md"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('users.refresh')}
          </button>
        </div>
      </header>

      {/* 表格 */}
      <div className="flex-1 flex flex-col bg-background m-4 border border-border min-h-0 rounded-sm overflow-hidden">
        <ScrollArea className="flex-1 h-0 w-full" type="always">
          <div className="min-w-full">
            <table
              className="w-full border-collapse table-auto"
              style={{ minWidth: 'max-content' }}
            >
              <thead>
                <tr>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-16">
                    {t('users.table.index')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                    {t('users.table.email')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                    {t('users.table.registeredAt')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-32">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="shrink-0">{t('users.table.status')}</span>
                      {statusFilter === 'all' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-32">
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('registered')}
                              className="text-xs cursor-pointer"
                            >
                              {t('users.status.registered')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('paid')}
                              className="text-xs cursor-pointer"
                            >
                              {t('users.status.paid')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('active')}
                              className="text-xs cursor-pointer"
                            >
                              {t('users.status.active')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
                          <span
                            className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                            title={t(`users.status.${statusFilter}`)}
                          >
                            {t(`users.status.${statusFilter}`)}
                          </span>
                          <button
                            onClick={() => onStatusFilterChange('all')}
                            className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                    {t('users.table.totalConsumption')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                    {t('users.table.last30DaysConsumption')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                    {t('users.table.link')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <ReferralTableSkeleton rows={8} />
                ) : users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <div className="text-xs">{t('users.noData')}</div>
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => (
                    <tr key={user.id} className="group hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-xs font-medium text-foreground">{user.email}</div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {new Date(user.registeredAt).toLocaleDateString('zh-CN')}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-primary/10 text-primary border-primary/30">
                          {t(`users.status.${user.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="font-semibold text-foreground">
                          ${formatMoney(user.totalConsumption)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="font-semibold text-foreground">
                          ${formatMoney(user.last30DaysConsumption)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] text-muted-foreground">
                          {getLinkDisplayName(user.linkId)}
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
      </div>

      {/* 分页 */}
      <ReferralPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => {
          if (page < 1 || page > Math.max(totalPages, 1)) return;
          onPageChange(page);
        }}
        namespace="users"
      />
    </div>
  );
};
