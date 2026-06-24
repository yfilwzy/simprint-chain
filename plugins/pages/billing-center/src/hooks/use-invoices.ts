import { useEffect, useState, useCallback } from 'react';
import type { Invoice } from '../types';
import { getInvoices, type InvoiceItem } from '../api';

interface UseInvoicesReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 转换后端发票格式为前端格式
 */
function transformInvoice(item: InvoiceItem): Invoice {
  return {
    id: item.uuid,
    createdAt: item.created_at,
    amount: Number(item.amount),
    currency: item.currency,
    status: item.status as 'paid' | 'pending' | 'failed',
    type: item.invoice_type,
    description: item.invoice_number,
    operator: '', // TODO: 如果后端有操作者字段，从后端获取
  };
}

/**
 * 获取账单列表的 Hook
 */
export function useInvoices(): UseInvoicesReturn {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getInvoices({
        pagination: {
          page: 1,
          page_size: 1000, // TODO: 如果需要分页，可以改为动态参数
        },
      });
      setInvoices(result.items.map(transformInvoice));
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    refresh: fetchInvoices,
  };
}
