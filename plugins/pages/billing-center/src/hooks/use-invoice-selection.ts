import { useState, useMemo } from 'react';
import type { Invoice } from '../types';

interface UseInvoiceSelectionReturn {
  selectedInvoiceIds: Set<string>;
  allInvoicesSelected: boolean;
  someInvoicesSelected: boolean;
  selectInvoice: (id: string, selected: boolean) => void;
  selectAllInvoices: (invoices: Invoice[], selected: boolean) => void;
  clearSelection: () => void;
}

/**
 * 发票选择逻辑 Hook
 */
export function useInvoiceSelection(invoices: Invoice[]): UseInvoiceSelectionReturn {
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  const selectInvoice = (id: string, selected: boolean) => {
    setSelectedInvoiceIds((prev) => {
      const newSelected = new Set(prev);
      if (selected) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
      }
      return newSelected;
    });
  };

  const selectAllInvoices = (invoicesToSelect: Invoice[], selected: boolean) => {
    if (selected) {
      setSelectedInvoiceIds(new Set(invoicesToSelect.map((inv) => inv.id)));
    } else {
      setSelectedInvoiceIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedInvoiceIds(new Set());
  };

  const allInvoicesSelected = useMemo(() => {
    return invoices.length > 0 && invoices.every((inv) => selectedInvoiceIds.has(inv.id));
  }, [invoices, selectedInvoiceIds]);

  const someInvoicesSelected = useMemo(() => {
    return invoices.some((inv) => selectedInvoiceIds.has(inv.id));
  }, [invoices, selectedInvoiceIds]);

  return {
    selectedInvoiceIds,
    allInvoicesSelected,
    someInvoicesSelected,
    selectInvoice,
    selectAllInvoices,
    clearSelection,
  };
}
