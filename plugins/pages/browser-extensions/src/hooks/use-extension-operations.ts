import { useState } from 'react';
import type { ExtensionItem, StoreExtension } from '../types';
import {
  installExtension as apiInstallExtension,
  uninstallExtension as apiUninstallExtension,
  updateExtension as apiUpdateExtension,
  batchUpdateExtensions as apiBatchUpdateExtensions,
  disableExtension as apiDisableExtension,
  enableExtension as apiEnableExtension,
  installLocalExtension as apiInstallLocalExtension,
  uninstallLocalExtension as apiUninstallLocalExtension,
  removeLocalExtension as apiRemoveLocalExtension,
  disableLocalExtension as apiDisableLocalExtension,
  enableLocalExtension as apiEnableLocalExtension,
} from '../api';

interface UseExtensionOperationsReturn {
  installing: boolean;
  installExtension: (
    extension: StoreExtension,
    groupIds: string[],
    forTeam: boolean
  ) => Promise<void>;
  updateExtension: (id: string) => Promise<ExtensionItem | null>;
  uninstallExtension: (extension: ExtensionItem) => Promise<void>;
  removeExtension: (extension: ExtensionItem) => Promise<void>;
  batchUpdate: (extensions: ExtensionItem[]) => Promise<void>;
  batchUninstall: (extensions: ExtensionItem[]) => Promise<void>;
  disableExtension: (extension: ExtensionItem) => Promise<void>;
  enableExtension: (extension: ExtensionItem) => Promise<void>;
}

/**
 * 扩展操作逻辑 Hook
 */
export function useExtensionOperations(onComplete?: () => void): UseExtensionOperationsReturn {
  const [installing, setInstalling] = useState(false);

  const installExtension = async (
    extension: StoreExtension,
    groupIds: string[],
    forTeam: boolean
  ) => {
    setInstalling(true);
    try {
      if (extension.source === 'local') {
        if (!extension.recordId) {
          throw new Error('本地插件缺少 recordId');
        }
        await apiInstallLocalExtension(extension.recordId);
        onComplete?.();
        return;
      }

      // 如果选择了分组
      if (groupIds.length > 0) {
        // 安装到分组，is_team_shared 由 forTeam 决定
        await apiInstallExtension({
          extension_id: extension.id,
          group_ids: groupIds,
          for_team: false,
          is_team_shared: forTeam, // forTeam 决定是否团队共享
        });
      } else {
        // 没有选择分组，根据 forTeam 决定安装到用户还是团队
        await apiInstallExtension({
          extension_id: extension.id,
          group_ids: undefined,
          for_team: forTeam,
          is_team_shared: undefined,
        });
      }
      onComplete?.();
    } finally {
      setInstalling(false);
    }
  };

  const updateExtension = async (id: string): Promise<ExtensionItem | null> => {
    try {
      const result = await apiUpdateExtension(id);
      onComplete?.();
      return {
        id: result.extensionId,
        uuid: result.id,
        recordId: result.recordId,
        extensionId: result.extensionId,
        name: result.name,
        description: result.description,
        version: result.version,
        icon: result.icon || '',
        browser: result.browser as ExtensionItem['browser'],
        status: result.status,
        source: result.source,
        author: result.author,
        homepage: result.homepage,
        downloads: result.downloads,
        rating: result.rating,
        updatedAt: result.updatedAt,
        createdAt: result.createdAt,
        fileSize: result.fileSize,
        permissions: result.permissions,
        hash: result.hash,
        scope: result.scope,
        groups: result.groups,
        category: result.category,
      };
    } catch {
      return null;
    }
  };

  const uninstallExtension = async (extension: ExtensionItem) => {
    try {
      if (extension.source === 'local') {
        if (!extension.recordId) {
          throw new Error('本地插件缺少 recordId');
        }
        await apiUninstallLocalExtension(extension.recordId);
        onComplete?.();
        return;
      }

      // 根据 scope 决定卸载类型和目标
      let targetType: 'user' | 'team' | 'group' = 'user';
      let targetUuid: string | undefined = undefined;

      // 从 extension 中获取 scope 信息
      const scope = (extension as any).scope as string | undefined;

      if (scope === 'team') {
        targetType = 'team';
      } else if (scope === 'group-personal' || scope === 'group-team') {
        targetType = 'group';
        // 如果是分组插件，需要提供 group_uuid
        // 从 groups 数组中获取第一个分组的 uuid
        const groups = (extension as any).groups as Array<{ uuid: string; name: string }> | undefined;
        if (groups && groups.length > 0) {
          targetUuid = groups[0].uuid;
        }
      } else {
        // 默认为用户插件
        targetType = 'user';
      }

      await apiUninstallExtension(extension.id, targetType, targetUuid);
      onComplete?.();
    } catch {
      // 错误已处理
    }
  };

  const batchUpdate = async (extensions: ExtensionItem[]) => {
    try {
      const remoteIds = extensions
        .filter((extension) => extension.source === 'remote')
        .map((extension) => extension.id);
      if (remoteIds.length > 0) {
        await apiBatchUpdateExtensions(remoteIds);
        onComplete?.();
      }
    } catch {
      // 忽略错误
    }
  };

  const removeExtension = async (extension: ExtensionItem) => {
    try {
      if (extension.source === 'local') {
        if (!extension.recordId) {
          throw new Error('本地插件缺少 recordId');
        }
        await apiRemoveLocalExtension(extension.recordId);
      } else {
        await uninstallExtension(extension);
        return;
      }
      onComplete?.();
    } catch {
      // 错误已处理
    }
  };

  const batchUninstall = async (extensions: ExtensionItem[]) => {
    // 后端没有批量卸载接口，逐个卸载
    for (const ext of extensions) {
      try {
        await uninstallExtension(ext);
      } catch {
        // 忽略单个错误
      }
    }
    onComplete?.();
  };

  const disableExtension = async (extension: ExtensionItem) => {
    try {
      if (extension.source === 'local') {
        if (!extension.recordId) {
          throw new Error('本地插件缺少 recordId');
        }
        await apiDisableLocalExtension(extension.recordId);
      } else {
        await apiDisableExtension(extension.id);
      }
      onComplete?.();
    } catch {
      // 错误已处理
    }
  };

  const enableExtension = async (extension: ExtensionItem) => {
    try {
      if (extension.source === 'local') {
        if (!extension.recordId) {
          throw new Error('本地插件缺少 recordId');
        }
        await apiEnableLocalExtension(extension.recordId);
      } else {
        await apiEnableExtension(extension.id);
      }
      onComplete?.();
    } catch {
      // 错误已处理
    }
  };

  return {
    installing,
    installExtension,
    updateExtension,
    uninstallExtension,
    removeExtension,
    batchUpdate,
    batchUninstall,
    disableExtension,
    enableExtension,
  };
}
