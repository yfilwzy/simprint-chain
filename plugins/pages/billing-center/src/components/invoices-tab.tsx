import { useTranslation } from 'react-i18next';
import { DollarSign, AlertCircle, CheckCircle2, ChevronDown, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { BillingTableSkeleton } from './billing-table-skeleton';
import { InvoiceDateFilter } from './invoice-date-filter';
import { BillingPagination } from './billing-pagination';
import type { Invoice, InvoiceStatusFilter } from '../types';

interface InvoicesTabProps {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: InvoiceStatusFilter;
  typeFilter: string;
  startDate: string;
  endDate: string;
  currentPage: number;
  totalPages: number;
  paginatedInvoices: Invoice[];
  stats: {
    total: number;
    todayCount: number;
    weekCount: number;
    todayAmount: number;
    weekAmount: number;
  };
  invoiceTypes: string[];
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: InvoiceStatusFilter) => void;
  onTypeFilterChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

/**
 * 账单标签页组件
 */
export function InvoicesTab({
  invoices: _invoices,
  loading,
  error,
  searchQuery,
  statusFilter,
  typeFilter,
  startDate,
  endDate,
  currentPage,
  totalPages,
  paginatedInvoices,
  stats,
  invoiceTypes,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onStartDateChange,
  onEndDateChange,
  onPageChange,
  onRefresh,
}: InvoicesTabProps) {
  const { t } = useTranslation('billing');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {error && (
        <div className="px-6 py-2 text-xs text-destructive">{t('invoices.error', { error })}</div>
      )}

      {/* 账单表格 */}
      <div className="flex-1 flex flex-col bg-background m-4 border border-border min-h-0 rounded-sm overflow-hidden">
        <ScrollArea className="flex-1 h-0 w-full" type="always">
          <div className="min-w-full">
            <table
              className="w-full border-collapse table-auto"
              style={{ minWidth: 'max-content' }}
            >
              <thead>
                <tr>
                  {/* 类型筛选 */}
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-40">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="shrink-0">{t('invoices.table.type')}</span>
                      {!typeFilter ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            {invoiceTypes.map((type) => (
                              <DropdownMenuItem
                                key={type}
                                onClick={() => onTypeFilterChange(type)}
                                className="text-xs cursor-pointer"
                              >
                                {type}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
                          <span
                            className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                            title={typeFilter}
                          >
                            {typeFilter}
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
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-40">
                    {t('invoices.table.amount')}
                  </th>
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-64">
                    {t('invoices.table.description')}
                  </th>
                  {/* 状态筛选 */}
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-40">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <span className="shrink-0">{t('invoices.table.status')}</span>
                      {statusFilter === 'all' ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors shrink-0">
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-32">
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('paid')}
                              className="text-xs cursor-pointer"
                            >
                              {t('invoices.statusPaid')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('pending')}
                              className="text-xs cursor-pointer"
                            >
                              {t('invoices.statusPending')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onStatusFilterChange('failed')}
                              className="text-xs cursor-pointer"
                            >
                              {t('invoices.statusFailed')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <>
                          <span
                            className="text-[9px] text-primary font-bold bg-primary/10 px-1 rounded max-w-[80px] truncate"
                            title={t(
                              `invoices.status${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`
                            )}
                          >
                            {t(
                              `invoices.status${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`
                            )}
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
                  <th className="sticky top-0 bg-muted z-5 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-40">
                    {t('invoices.table.operator')}
                  </th>
                  {/* 日期筛选 */}
                  <th className="sticky top-0 right-0 bg-muted z-10 text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border w-48">
                    <div className="flex items-center gap-1">
                      <span>{t('invoices.table.date')}</span>
                      <InvoiceDateFilter
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={onStartDateChange}
                        onEndDateChange={onEndDateChange}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <BillingTableSkeleton rows={8} />
                ) : paginatedInvoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                      <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <div className="text-xs">{t('invoices.noData')}</div>
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((inv) => (
                    <tr key={inv.id} className="group hover:bg-muted transition-colors">
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="font-bold">{inv.type}</div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="font-mono font-medium text-foreground">
                          {inv.amount} {inv.currency}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] font-medium">{inv.description}</div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        {inv.status === 'paid' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('invoices.statusPaid')}
                          </span>
                        )}
                        {inv.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-amber-500/10 text-amber-500 border-amber-500/30">
                            <AlertCircle className="h-3 w-3" />
                            {t('invoices.statusPending')}
                          </span>
                        )}
                        {inv.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-destructive/10 text-destructive border-destructive/30">
                            <AlertCircle className="h-3 w-3" />
                            {t('invoices.statusFailed')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] text-muted-foreground">{inv.operator}</div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-border text-[13px]">
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {inv.createdAt}
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
      <BillingPagination
        currentPage={totalPages === 0 ? 0 : currentPage}
        totalPages={totalPages}
        onPageChange={(page) => {
          if (page < 1 || page > totalPages) return;
          onPageChange(page);
        }}
      />
    </div>
  );
}
