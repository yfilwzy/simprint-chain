import { useState, useCallback } from 'react';
import { listExtensions, listInstalledExtensions, listLocalExtensions, type Extension } from '../api';
import type { ExtensionItem } from '../types';

interface UseExtensionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  sortBy?: 'downloads' | 'rating' | 'name' | 'newest';
  sortOrder?: 'asc' | 'desc';
}

interface UseExtensionsReturn {
  extensions: ExtensionItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 将 API Extension 转换为 ExtensionItem
 */
function toExtensionItem(ext: Extension): ExtensionItem {
  return {
    // 业务 ID 使用 extensionId（后端的 extension_id）
    id: ext.extensionId,
    // 保留后端 uuid 以便需要时使用
    uuid: ext.id,
    recordId: ext.recordId,
    extensionId: ext.extensionId,
    name: ext.name,
    description: ext.description,
    version: ext.version,
    icon: ext.icon || '',
    browser: ext.browser as ExtensionItem['browser'],
    status: ext.status,
    source: ext.source,
    author: ext.author,
    homepage: ext.homepage,
    downloads: ext.downloads,
    rating: ext.rating,
    updatedAt: ext.updatedAt,
    createdAt: ext.createdAt,
    fileSize: ext.fileSize,
    permissions: ext.permissions,
    hash: ext.hash,
    scope: ext.scope, // 保留 scope 信息
    groups: ext.groups, // 关联的分组列表
    category: ext.category,
  };
}

/**
 * 获取扩展列表的 Hook
 *
 * @param mode - 'all' 获取所有扩展（商店），'installed' 获取已安装扩展
 * @param scope - 范围过滤：'all' | 'user' | 'team'（仅用于 installed 模式）
 */
export function useExtensions(
  mode: 'all' | 'installed' | 'local' = 'all',
  scope: 'all' | 'user' | 'team' = 'all',
  params?: UseExtensionsParams
): UseExtensionsReturn {
  const [extensions, setExtensions] = useState<ExtensionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExtensions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'installed') {
        const data = await listInstalledExtensions(scope);
        setExtensions(data.map(toExtensionItem));
        setTotal(data.length);
      } else if (mode === 'local') {
        const data = await listLocalExtensions();
        setExtensions(data.map(toExtensionItem));
        setTotal(data.length);
      } else {
        const data = await listExtensions({
          page: params?.page,
          page_size: params?.pageSize,
          search: params?.search,
          category: params?.category,
          sort_by: params?.sortBy,
          sort_order: params?.sortOrder,
        });
        setExtensions(data.items.map(toExtensionItem));
        setTotal(data.total);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取扩展列表失败');
    } finally {
      setLoading(false);
    }
  }, [mode, params?.category, params?.page, params?.pageSize, params?.search, params?.sortBy, params?.sortOrder, scope]);

  return {
    extensions,
    total,
    loading,
    error,
    refresh: fetchExtensions,
  };
}
