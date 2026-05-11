export interface ExtensionItem {
  /**
   * 用于业务操作的唯一 ID。
   * 远端插件使用 extension_id，本地插件使用 record_id。
   */
  id: string;
  /**
   * 后端扩展记录的 UUID（仅用于展示/调试，不用于接口调用）
   */
  uuid?: string;
  recordId?: string;
  extensionId?: string;
  name: string;
  description: string;
  version: string;
  status: 'installed' | 'available' | 'update' | 'disabled' | 'active';
  icon?: string;
  browser: 'chrome' | 'firefox' | 'edge' | 'all';
  source: 'remote' | 'local';
  author?: string;
  homepage?: string;
  downloads?: number;
  rating?: number;
  updatedAt?: string;
  createdAt?: string;
  fileSize?: number;
  permissions?: string[];
  hash?: string;
  scope?: 'user' | 'team' | 'group-personal' | 'group-team' | 'local'; // 安装范围
  groups?: Array<{
    uuid: string;
    name: string;
  }>; // 关联的分组列表（包含 uuid 和 name）
  category?: string;
}

export interface StoreExtension extends ExtensionItem {
  category?: string;
  rating?: number;
  isInstalled?: boolean;
}

export type ExtensionStatus = 'installed' | 'available' | 'update' | 'disabled' | 'active';
export type ExtensionBrowser = 'chrome' | 'firefox' | 'edge' | 'all';
export type ExtensionCategory =
  | 'automation'
  | 'security'
  | 'productivity'
  | 'tools'
  | 'media'
  | 'social';
export type ViewMode = 'installed' | 'store' | 'local';
export type SortOption = 'downloads' | 'rating' | 'name' | 'newest';
