import { useState, useMemo } from 'react';
import type { ExtensionItem } from '../types';

interface UseExtensionSelectionReturn {
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  select: (id: string, selected: boolean) => void;
  selectAll: (extensions: ExtensionItem[], selected: boolean) => void;
  clearSelection: () => void;
}

/**
 * 扩展选择逻辑 Hook
 */
export function useExtensionSelection(extensions: ExtensionItem[]): UseExtensionSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const select = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAll = (extensionsToSelect: ExtensionItem[], selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(extensionsToSelect.map((e) => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const allSelected = useMemo(() => {
    return extensions.length > 0 && extensions.every((ext) => selectedIds.has(ext.id));
  }, [extensions, selectedIds]);

  const someSelected = useMemo(() => {
    return extensions.some((ext) => selectedIds.has(ext.id));
  }, [extensions, selectedIds]);

  return {
    selectedIds,
    allSelected,
    someSelected,
    select,
    selectAll,
    clearSelection,
  };
}
