import { useMemo } from 'react';
import type { Invoice, InvoiceStatusFilter } from '../types';

interface InvoiceFilters {
  searchQuery: string;
  statusFilter: InvoiceStatusFilter;
  typeFilter: string;
  startDate: string;
  endDate: string;
}

/**
 * 账单过滤 Hook
 */
export function useInvoiceFilters(invoices: Invoice[], filters: InvoiceFilters): Invoice[] {
  return useMemo(() => {
    let result = [...invoices];

    // 搜索筛选
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.type.toLowerCase().includes(query) ||
          inv.description.toLowerCase().includes(query) ||
          inv.operator.toLowerCase().includes(query) ||
          inv.id.toLowerCase().includes(query)
      );
    }

    // 状态筛选
    if (filters.statusFilter !== 'all') {
      result = result.filter((inv) => inv.status === filters.statusFilter);
    }

    // 类型筛选
    if (filters.typeFilter) {
      result = result.filter((inv) => inv.type === filters.typeFilter);
    }

    // 日期筛选
    if (filters.startDate) {
      result = result.filter((inv) => inv.createdAt >= filters.startDate);
    }
    if (filters.endDate) {
      result = result.filter((inv) => inv.createdAt <= filters.endDate + ' 23:59:59');
    }

    return result;
  }, [
    invoices,
    filters.searchQuery,
    filters.statusFilter,
    filters.typeFilter,
    filters.startDate,
    filters.endDate,
  ]);
}
