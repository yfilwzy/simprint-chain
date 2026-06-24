import { useMemo } from 'react';
import type { Invoice } from '../types';

interface InvoiceStats {
  total: number;
  todayCount: number;
  weekCount: number;
  todayAmount: number;
  weekAmount: number;
}

/**
 * 账单统计数据 Hook
 */
export function useInvoiceStats(invoices: Invoice[]): InvoiceStats {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayInvoices = invoices.filter((inv) => inv.createdAt.startsWith(today));
    const weekInvoices = invoices.filter((inv) => inv.createdAt >= weekAgo);
    const todayAmount = todayInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const weekAmount = weekInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    return {
      total: invoices.length,
      todayCount: todayInvoices.length,
      weekCount: weekInvoices.length,
      todayAmount,
      weekAmount,
    };
  }, [invoices]);
}
