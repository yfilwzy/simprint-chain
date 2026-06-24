import { useEffect, useMemo } from 'react';
import { useInvoices } from './use-invoices';
import { useInvoiceFilters } from './use-invoice-filters';
import { useInvoicePagination } from './use-invoice-pagination';
import { useInvoiceStats } from './use-invoice-stats';
import { useInvoiceSelection } from './use-invoice-selection';
import type { InvoiceStatusFilter } from '../types';

interface InvoiceFilters {
  searchQuery: string;
  statusFilter: InvoiceStatusFilter;
  typeFilter: string;
  startDate: string;
  endDate: string;
}

interface UseInvoicesDataReturn {
  invoices: ReturnType<typeof useInvoices>;
  filteredInvoices: ReturnType<typeof useInvoiceFilters>;
  pagination: ReturnType<typeof useInvoicePagination>;
  stats: ReturnType<typeof useInvoiceStats>;
  selection: ReturnType<typeof useInvoiceSelection>;
  invoiceTypes: string[];
}

/**
 * 整合发票相关数据的 Hook
 */
export function useInvoicesData(
  filters: InvoiceFilters,
  currentPage: number,
  activeTab: 'wallet' | 'invoices'
): UseInvoicesDataReturn {
  const invoices = useInvoices();

  const filteredInvoices = useInvoiceFilters(invoices.invoices, filters);
  const pagination = useInvoicePagination(filteredInvoices, currentPage);
  const stats = useInvoiceStats(filteredInvoices);
  const selection = useInvoiceSelection(pagination.paginatedInvoices);

  const invoiceTypes = useMemo(() => {
    const types = new Set(invoices.invoices.map((inv) => inv.type));
    return Array.from(types);
  }, [invoices.invoices]);

  return {
    invoices,
    filteredInvoices,
    pagination,
    stats,
    selection,
    invoiceTypes,
  };
}
