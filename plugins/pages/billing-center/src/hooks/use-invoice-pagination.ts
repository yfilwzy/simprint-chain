import { useMemo } from 'react';
import type { Invoice } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface UseInvoicePaginationReturn {
  paginatedInvoices: Invoice[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 账单分页 Hook
 */
export function useInvoicePagination(
  invoices: Invoice[],
  currentPage: number
): UseInvoicePaginationReturn {
  const { paginatedInvoices, totalPages, startIndex, endIndex } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(invoices.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedInvoices = invoices.slice(startIndex, endIndex);

    return {
      paginatedInvoices,
      totalPages,
      startIndex,
      endIndex,
    };
  }, [invoices, currentPage]);

  return {
    paginatedInvoices,
    totalPages,
    startIndex,
    endIndex,
  };
}
