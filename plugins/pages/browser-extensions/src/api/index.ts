import { post, isSuccess } from '@/lib/request';
import { invoke } from '@/lib/tauri';

// API 端点配置
export const API_ENDPOINTS = {
  // 扩展市场
  LIST_EXTENSIONS: 'extensions/list',
  EXTENSION_DETAIL: 'extensions/detail',
  CATEGORIES: 'extensions/categories',
  // 已安装扩展
  INSTALLED: 'extensions/installed',
  // 安装/卸载/更新
  INSTALL: 'extensions/install',
  UNINSTALL: 'extensions/uninstall',
  UPDATE: 'extensions/update',
  BATCH_UPDATE: 'extensions/batch-update',
  // 禁用/启用
  DISABLE: 'extensions/disable',
  ENABLE: 'extensions/enable',
} as const;

/**
 * 扩展 DTO（后端返回格式）
 */
export interface ExtensionDto {
  id: number;
  uuid: string;
  extension_id: string;
  name: string;
  description?: string;
  version: string;
  category?: string;
  browser: string;
  developer?: string;
  homepage?: string;
  icon_url?: string;
  download_url?: string;
  file_size?: number;
  downloads_count?: number;
  rating?: string | number;
  permissions?: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * 扩展（前端格式）
 */
export interface Extension {
  id: string;
  extensionId: string;
  recordId?: string;
  name: string;
  description: string;
  version: string;
  category?: string;
  browser: string;
  source: 'remote' | 'local';
  author?: string;
  homepage?: string;
  icon?: string;
  downloadUrl?: string;
  managedCrxPath?: string;
  fileSize?: number;
  downloads?: number;
  permissions?: string[];
  status: 'installed' | 'available' | 'update' | 'disabled' | 'active';
  rating?: number;
  updatedAt?: string;
  createdAt?: string;
  hash?: string;
  scope?: 'user' | 'team' | 'group-personal' | 'group-team' | 'local'; // 安装范围
  groups?: Array<{
    uuid: string;
    name: string;
  }>; // 关联的分组列表（包含 uuid 和 name）
}

/**
 * 转换 DTO 到前端格式
 */
function transformExtensionDto(dto: ExtensionDto): Extension {
  return {
    id: dto.uuid,
    extensionId: dto.extension_id,
    source: 'remote',
    name: dto.name,
    description: dto.description || '',
    version: dto.version,
    category: dto.category as Extension['category'],
    browser: dto.browser,
    author: dto.developer,
    homepage: dto.homepage,
    icon: dto.icon_url,
    downloadUrl: dto.download_url,
    fileSize: dto.file_size,
    downloads: dto.downloads_count,
    permissions: dto.permissions,
    status: (dto.status as Extension['status']) || 'available',
    rating: dto.rating
      ? typeof dto.rating === 'string'
        ? parseFloat(dto.rating)
        : dto.rating
      : undefined,
    updatedAt: dto.updated_at,
    createdAt: dto.created_at,
    hash: undefined,
  };
}

export interface LocalExtensionDto {
  recordId: string;
  extensionId: string;
  name: string;
  description: string;
  version: string;
  browser: string;
  status: 'available' | 'active' | 'disabled';
  source: 'local';
  author?: string;
  homepage?: string;
  iconUrl?: string;
  category?: string;
  permissions?: string[];
  hash?: string;
  fileSize?: number;
  downloadsCount?: number;
  rating?: string | number;
  importState?: 'imported' | 'already_exists' | 'already_installed';
  importedAt: string;
  updatedAt: string;
}

export type LocalExtensionImportState = 'imported' | 'alreadyExists' | 'alreadyInstalled';

export interface LocalExtensionImportResult {
  extension: Extension;
  importState: LocalExtensionImportState;
}

function transformLocalExtensionDto(dto: LocalExtensionDto): Extension {
  return {
    id: dto.recordId,
    recordId: dto.recordId,
    extensionId: dto.extensionId,
    name: dto.name,
    description: dto.description || '',
    version: dto.version,
    category: dto.category,
    browser: dto.browser || 'chrome',
    source: 'local',
    author: dto.author,
    homepage: dto.homepage,
    icon: dto.iconUrl,
    downloadUrl: undefined,
    fileSize: dto.fileSize,
    downloads: dto.downloadsCount,
    permissions: dto.permissions,
    status:
      dto.status === 'active' ? 'active' : dto.status === 'disabled' ? 'disabled' : 'available',
    rating:
      dto.rating !== undefined
        ? typeof dto.rating === 'string'
          ? parseFloat(dto.rating)
          : dto.rating
        : undefined,
    updatedAt: dto.updatedAt,
    createdAt: dto.importedAt,
    hash: dto.hash,
    scope: dto.status === 'available' ? undefined : 'local',
    groups: undefined,
  };
}

export interface ListExtensionsResponse {
  items: Extension[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 获取扩展市场列表
 */
export async function listExtensions(params?: {
  category?: string;
  search?: string;
  sort_by?: 'downloads' | 'rating' | 'name' | 'newest';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}): Promise<ListExtensionsResponse> {
  const result = await post<{
    items: ExtensionDto[];
    total: number;
    page: number;
    page_size: number;
  }>(API_ENDPOINTS.LIST_EXTENSIONS, {
    page: params?.page || 1,
    page_size: params?.page_size || 12,
    filters: {
      category: params?.category,
      keyword: params?.search,
      sort_by: params?.sort_by,
      sort_order: params?.sort_order,
    },
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取扩展列表失败');
  }
  return {
    items: (result.data?.items || []).map(transformExtensionDto),
    total: result.data?.total || 0,
    page: result.data?.page || params?.page || 1,
    page_size: result.data?.page_size || params?.page_size || 12,
  };
}

/**
 * 获取扩展详情
 */
export async function getExtensionDetail(extensionId: string): Promise<Extension> {
  const result = await post<ExtensionDto>(API_ENDPOINTS.EXTENSION_DETAIL, {
    extension_id: extensionId,
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取扩展详情失败');
  }
  return transformExtensionDto(result.data!);
}

/**
 * 已安装扩展项（后端返回格式，包含完整扩展详情）
 */
export interface InstalledExtensionItemDto {
  extension_id: string;
  name: string;
  version: string;
  installed_version: string;
  has_update: boolean;
  status: string;
  installed_at: string;
  homepage?: string;
  icon_url?: string;
  team_uuid?: string;
  scope: 'user' | 'team' | 'group-personal' | 'group-team';
  // 完整扩展详情字段
  description?: string;
  category?: string;
  browser?: string;
  developer?: string;
  downloads_count?: number;
  rating?: string | number;
  permissions?: string[];
  file_size?: number;
  updated_at?: string;
  groups?: Array<{
    uuid: string;
    name: string;
  }>;
}

/**
 * 已安装扩展响应（后端返回格式）
 */
export interface InstalledExtensionsResponseDto {
  user_extensions: InstalledExtensionItemDto[];
  team_extensions: InstalledExtensionItemDto[];
}

/**
 * 获取已安装扩展列表
 *
 * @param scope - 范围过滤：'all' | 'user' | 'team'
 */
export async function listInstalledExtensions(
  scope: 'all' | 'user' | 'team' = 'all'
): Promise<Extension[]> {
  const result = await post<InstalledExtensionsResponseDto>(API_ENDPOINTS.INSTALLED, {
    scope: scope === 'all' ? 'all' : scope === 'user' ? 'user' : 'team',
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取已安装扩展失败');
  }

  const data = result.data;
  if (!data) {
    return [];
  }

  // 合并用户和团队的已安装扩展
  const allInstalled: InstalledExtensionItemDto[] = [
    ...(data.user_extensions || []),
    ...(data.team_extensions || []),
  ];

  // 去重（同一个扩展可能在用户和团队中都存在）
  const uniqueExtensions = new Map<string, InstalledExtensionItemDto>();
  for (const item of allInstalled) {
    if (!uniqueExtensions.has(item.extension_id)) {
      uniqueExtensions.set(item.extension_id, item);
    }
  }

  // 直接使用后端返回的完整信息，无需再次调用详情接口
  const extensions: Extension[] = [];
  for (const installedItem of Array.from(uniqueExtensions.values())) {
    // 根据 status 和 has_update 设置状态
    let status: Extension['status'];
    if (installedItem.status === 'disabled') {
      status = 'disabled';
    } else if (installedItem.has_update) {
      status = 'update';
    } else if (installedItem.status === 'active') {
      status = 'active';
    } else {
      status = 'installed';
    }

    // 转换评分
    const rating = installedItem.rating
      ? typeof installedItem.rating === 'string'
        ? parseFloat(installedItem.rating)
        : installedItem.rating
      : undefined;

    extensions.push({
      id: installedItem.extension_id, // 使用 extension_id 作为业务 ID
      extensionId: installedItem.extension_id,
      source: 'remote',
      name: installedItem.name,
      description: installedItem.description || '',
      version: installedItem.installed_version, // 使用已安装的版本号
      category: installedItem.category as Extension['category'],
      browser: installedItem.browser || 'chrome',
      author: installedItem.developer,
      homepage: installedItem.homepage,
      icon: installedItem.icon_url,
      downloadUrl: undefined, // 已安装扩展不需要下载 URL
      fileSize: installedItem.file_size,
      downloads: installedItem.downloads_count,
      permissions: installedItem.permissions as string[] | undefined,
      status,
      rating,
      updatedAt: installedItem.updated_at,
      createdAt: undefined, // 已安装扩展不需要创建时间
      hash: undefined,
      scope: installedItem.scope, // 保留 scope 信息
      groups: installedItem.groups, // 关联的分组列表（包含 uuid 和 name）
    });
  }

  if (scope !== 'team') {
    const localExtensions = await listLocalExtensions();
    extensions.push(
      ...localExtensions
        .filter((item) => item.status === 'active' || item.status === 'disabled')
        .map((item) => ({
          ...item,
          status: item.status,
          scope: 'local' as const,
        }))
    );
  }

  return extensions;
}

/**
 * 安装扩展
 */
export async function installExtension(data: {
  extension_id: string;
  group_ids?: string[];
  for_team?: boolean;
  is_team_shared?: boolean;
}): Promise<void> {
  // 确定 target_type
  let target_type: string;
  let group_ids: string[] | undefined;
  let is_team_shared: boolean | undefined;

  if (data.for_team) {
    target_type = 'team';
    group_ids = undefined;
    is_team_shared = undefined;
  } else if (data.group_ids && data.group_ids.length > 0) {
    target_type = 'group';
    group_ids = data.group_ids; // 即使只有一个分组也传入数组
    is_team_shared = data.is_team_shared; // 分组插件支持团队共享
  } else {
    target_type = 'user';
    group_ids = undefined;
    is_team_shared = undefined;
  }

  const result = await post(API_ENDPOINTS.INSTALL, {
    extension_id: data.extension_id,
    target_type,
    group_ids,
    is_team_shared,
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '安装扩展失败');
  }
}

/**
 * 卸载扩展
 */
export async function uninstallExtension(
  extensionId: string,
  targetType?: 'user' | 'team' | 'group',
  targetUuid?: string
): Promise<void> {
  const payload: {
    extension_id: string;
    target_type?: string;
    target_uuid?: string;
  } = {
    extension_id: extensionId,
  };

  if (targetType) {
    payload.target_type = targetType;
  }

  if (targetUuid) {
    payload.target_uuid = targetUuid;
  }

  const result = await post(API_ENDPOINTS.UNINSTALL, payload);
  if (!isSuccess(result)) {
    throw new Error(result.message || '卸载扩展失败');
  }
}

/**
 * 更新扩展
 */
export async function updateExtension(extensionId: string): Promise<Extension> {
  const result = await post<ExtensionDto>(API_ENDPOINTS.UPDATE, { extension_id: extensionId });
  if (!isSuccess(result)) {
    throw new Error(result.message || '更新扩展失败');
  }
  return transformExtensionDto(result.data!);
}

/**
 * 批量更新扩展
 */
export async function batchUpdateExtensions(extensionIds: string[]): Promise<void> {
  const result = await post(API_ENDPOINTS.BATCH_UPDATE, { extension_ids: extensionIds });
  if (!isSuccess(result)) {
    throw new Error(result.message || '批量更新失败');
  }
}

/**
 * 获取扩展分类列表
 */
export async function getCategories(): Promise<string[]> {
  const result = await post<{ categories: string[] }>(API_ENDPOINTS.CATEGORIES, {});
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取分类列表失败');
  }
  return result.data?.categories || [];
}

/**
 * 分组项类型
 */
export interface GroupItem {
  uuid: string;
  name: string;
  description?: string;
}

/**
 * 获取分组列表
 */
export async function listGroups(): Promise<GroupItem[]> {
  const result = await post<any[]>('groups/list', {});
  if (!isSuccess(result)) {
    throw new Error(result.message || '获取分组列表失败');
  }
  return (result.data || []).map((dto: any) => ({
    uuid: dto.uuid || '',
    name: dto.name || '',
    description: dto.description,
  }));
}

/**
 * 禁用扩展（用户级别）
 */
export async function disableExtension(extensionId: string): Promise<void> {
  const result = await post(API_ENDPOINTS.DISABLE, {
    extension_id: extensionId,
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '禁用扩展失败');
  }
}

/**
 * 启用扩展（用户级别）
 */
export async function enableExtension(extensionId: string): Promise<void> {
  const result = await post(API_ENDPOINTS.ENABLE, {
    extension_id: extensionId,
  });
  if (!isSuccess(result)) {
    throw new Error(result.message || '启用扩展失败');
  }
}

export async function listLocalExtensions(): Promise<Extension[]> {
  const result = await invoke<LocalExtensionDto[]>('list_local_extensions');
  return result.map(transformLocalExtensionDto);
}

export async function importLocalExtensionCrx(path: string): Promise<LocalExtensionImportResult> {
  const result = await invoke<LocalExtensionDto>('import_local_extension_crx', {
    path,
  });
  return transformLocalImportResult(result);
}

export async function importLocalExtensionStoreUrl(
  storeUrl: string
): Promise<LocalExtensionImportResult> {
  const result = await invoke<LocalExtensionDto>('import_local_extension_store_url', {
    storeUrl,
  });
  return transformLocalImportResult(result);
}

function transformLocalImportResult(dto: LocalExtensionDto): LocalExtensionImportResult {
  return {
    extension: transformLocalExtensionDto(dto),
    importState:
      dto.importState === 'already_installed'
        ? 'alreadyInstalled'
        : dto.importState === 'already_exists'
          ? 'alreadyExists'
          : 'imported',
  };
}

export async function installLocalExtension(recordId: string): Promise<Extension> {
  const result = await invoke<LocalExtensionDto>('install_local_extension', {
    recordId,
  });
  return transformLocalExtensionDto(result);
}

export async function uninstallLocalExtension(recordId: string): Promise<Extension> {
  const result = await invoke<LocalExtensionDto>('uninstall_local_extension', {
    recordId,
  });
  return transformLocalExtensionDto(result);
}

export async function removeLocalExtension(recordId: string): Promise<void> {
  await invoke('remove_local_extension', {
    recordId,
  });
}

export async function disableLocalExtension(recordId: string): Promise<Extension> {
  const result = await invoke<LocalExtensionDto>('disable_local_extension', {
    recordId,
  });
  return transformLocalExtensionDto(result);
}

export async function enableLocalExtension(recordId: string): Promise<Extension> {
  const result = await invoke<LocalExtensionDto>('enable_local_extension', {
    recordId,
  });
  return transformLocalExtensionDto(result);
}
