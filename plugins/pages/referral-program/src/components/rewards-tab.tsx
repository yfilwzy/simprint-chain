import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Gift,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  X,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ReferralPagination } from './referral-pagination';
import { RewardTableSkeleton } from './reward-table-skeleton';
import type { ReferralReward, RewardStatusFilter } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface RewardsTabProps {
  rewards: ReferralReward[];
  loading: boolean;
  totalPages: number;
  currentPage: number;
  statusFilter: RewardStatusFilter;
  typeFilter: string;
  searchQuery: string;
  rewardTypes: string[];
  onRefresh: () => Promise<void>;
  onPageChange: (page: number) => void;
  onStatusFilterChange: (filter: RewardStatusFilter) => void;
  onTypeFilterChange: (filter: string) => void;
  onSearchChange: (query: string) => void;
}

export const RewardsTab: React.FC<RewardsTabProps> = ({
  rewards,
  loading,
  totalPages,
  currentPage,
  statusFilter,
  typeFilter,
  searchQuery,
  rewardTypes,
  onRefresh,
  onPageChange,
  onStatusFilterChange,
  onTypeFilterChange,
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

  return (
    <div className="flex flex-col h-[calc(100vh-50px)]">
      {/* 顶部搜索和筛选栏 */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background z-10">
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('rewards.searchPlaceholder')}
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
            {t('rewards.refresh')}
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
                    {t('rewards.table.index')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                    {t('rewards.table.date')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-32">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="shrink-0">{t('rewards.table.type')}</span>
                      {!typeFilter ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-32">
                            {rewardTypes.map((type) => (
                              <DropdownMenuItem
                                key={type}
                                onClick={() => onTypeFilterChange(type)}
                                className="text-xs cursor-pointer"
                              >
                                {t(`rewards.types.${type}`)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
                          <span
                            className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                            title={t(`rewards.types.${typeFilter}`)}
                          >
                            {t(`rewards.types.${typeFilter}`)}
                          </span>
                          <button
                            onClick={() => onTypeFilterChange('')}
                            className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                    {t('rewards.table.description')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
                    {t('rewards.table.points')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-32">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="shrink-0">{t('rewards.table.status')}</span>
                      {statusFilter === 'all' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-32">
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('pending')}
                              className="text-xs cursor-pointer"
                            >
                              {t('rewards.status.pending')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('approved')}
                              className="text-xs cursor-pointer"
                            >
                              {t('rewards.status.approved')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('rejected')}
                              className="text-xs cursor-pointer"
                            >
                              {t('rewards.status.rejected')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
                          <span
                            className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                            title={t(`rewards.status.${statusFilter}`)}
                          >
                            {t(`rewards.status.${statusFilter}`)}
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
                    {t('rewards.table.user')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <RewardTableSkeleton rows={8} />
                ) : rewards.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      <Gift className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <div className="text-xs">{t('rewards.noData')}</div>
                    </td>
                  </tr>
                ) : (
                  rewards.map((reward, index) => (
                    <tr key={reward.id} className="group hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {new Date(reward.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-xs font-medium">
                          {t(`rewards.types.${reward.type}`)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] text-foreground">{reward.description}</div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="font-semibold text-foreground">{reward.points}</div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        {reward.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-amber-500/10 text-amber-500 border-amber-500/30">
                            <Clock className="h-3 w-3" />
                            {t('rewards.status.pending')}
                          </span>
                        )}
                        {reward.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('rewards.status.approved')}
                          </span>
                        )}
                        {reward.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-destructive/10 text-destructive border-destructive/30">
                            <XCircle className="h-3 w-3" />
                            {t('rewards.status.rejected')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] text-muted-foreground">
                          {reward.referredUser || '-'}
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
        namespace="rewards"
      />
    </div>
  );
};
