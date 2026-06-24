import { useMemo } from 'react';
import type { ExtensionItem } from '../types';
import { ITEMS_PER_PAGE } from '../constants';

interface UseExtensionPaginationReturn {
  paginatedExtensions: ExtensionItem[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 扩展分页 Hook
 */
export function useExtensionPagination(
  extensions: ExtensionItem[],
  currentPage: number
): UseExtensionPaginationReturn {
  const { paginatedExtensions, totalPages, startIndex, endIndex } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(extensions.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedExtensions = extensions.slice(startIndex, endIndex);

    return {
      paginatedExtensions,
      totalPages,
      startIndex,
      endIndex,
    };
  }, [extensions, currentPage]);

  return {
    paginatedExtensions,
    totalPages,
    startIndex,
    endIndex,
  };
}
