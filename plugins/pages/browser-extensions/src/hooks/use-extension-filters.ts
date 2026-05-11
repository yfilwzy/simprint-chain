import { useMemo } from 'react';
import type { ExtensionItem, StoreExtension } from '../types';

interface ExtensionFilters {
  searchQuery: string;
  scopeFilter: string;
}

/**
 * 扩展过滤 Hook
 */
export function useExtensionFilters(
  extensions: ExtensionItem[],
  filters: ExtensionFilters
): ExtensionItem[] {
  return useMemo(() => {
    let result = extensions.filter((e) => e.status === 'installed' || e.status === 'update');

    // 搜索过滤
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (ext) =>
          ext.name.toLowerCase().includes(query) ||
          ext.description.toLowerCase().includes(query) ||
          ext.author?.toLowerCase().includes(query)
      );
    }

    // 作用域过滤（如果需要）
    // if (filters.scopeFilter && filters.scopeFilter !== 'all') {
    //   result = result.filter((ext) => ext.scope === filters.scopeFilter);
    // }

    return result;
  }, [extensions, filters.searchQuery, filters.scopeFilter]);
}

/**
 * 转换为商店扩展格式
 */
export function useStoreExtensions(extensions: ExtensionItem[]): StoreExtension[] {
  return useMemo(() => {
    return extensions.map((ext) => ({
      ...ext,
      // 使用后端返回的 rating，如果没有则不显示
      rating: ext.rating,
    }));
  }, [extensions]);
}
