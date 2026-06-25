import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HardDrive,
  FolderOpen,
  Download,
  RefreshCcw,
  FlaskConical,
  Database,
  FileBox,
  FileText,
  Copy,
  ExternalLink,
  Settings,
  RotateCcw,
  Loader2,
  X,
  Upload,
  DatabaseBackup,
} from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@/lib/tauri';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { SettingCard } from './setting-card';
import { SettingRow } from './setting-row';
import { StoragePanelSkeleton } from './storage-panel-skeleton';
import {
  getStorageSettings,
  setStorageSettings,
} from '../../../../services/store/src';
import {
  getStorageDefaultPaths,
  getDirectorySizes,
} from '../api/storage';
import { openPath } from '@tauri-apps/plugin-opener';
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog';
import type { DirectorySizeCache, StoragePathKey } from '../../../../services/store/src';

interface StorageItemDef {
  id: string;
  key: StoragePathKey | 'profilesPath' | 'downloadsPath';
  nameKey: string;
  descKey: string;
  icon: React.ElementType;
  color: string;
  readonly?: boolean; // 只读目录，不允许用户配置
}

const STORAGE_ITEM_DEFS: StorageItemDef[] = [
  { id: 'profiles', key: 'profilesPath', nameKey: 'storageProfiles', descKey: 'storageProfilesDesc', icon: Database, color: 'bg-blue-500', readonly: true },
  { id: 'cache', key: 'cachePath', nameKey: 'storageCache', descKey: 'storageCacheDesc', icon: HardDrive, color: 'bg-amber-500' },
  { id: 'logs', key: 'logsPath', nameKey: 'storageLogs', descKey: 'storageLogsDesc', icon: FileText, color: 'bg-emerald-500' },
  { id: 'downloads', key: 'downloadsPath', nameKey: 'storageDownloads', descKey: 'storageDownloadsDesc', icon: FileBox, color: 'bg-purple-500', readonly: true },
];

const EMPTY_SIZES = STORAGE_ITEM_DEFS.map(() => 0);

function isDirectorySizeCacheValid(
  cache: DirectorySizeCache | undefined,
  paths: string[]
): cache is DirectorySizeCache {
  return Boolean(
    cache &&
      cache.paths.length === paths.length &&
      cache.sizes.length === paths.length &&
      cache.paths.every((path, index) => path === paths[index])
  );
}

/**
 * 存储与更新面板
 */
export const StoragePanel: React.FC = () => {
  const { t } = useTranslation('settings');
  const [betaChannel, setBetaChannel] = useState(true);
  const [storageSettingsLoaded, setStorageSettingsLoaded] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  const [defaultPaths, setDefaultPaths] = useState<{
    app_base: string;
    profiles: string;
    cache: string;
    logs: string;
    downloads: string;
  } | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [sizes, setSizes] = useState<number[]>(EMPTY_SIZES);
  const [pathsLoading, setPathsLoading] = useState(true);
  const [sizesLoading, setSizesLoading] = useState(true);
  const [sizesRefreshing, setSizesRefreshing] = useState(false);
  const [sizesUpdatedAt, setSizesUpdatedAt] = useState<number | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);

  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateChecked, setUpdateChecked] = useState(false);

  // 数据备份相关状态
  const [dbInfo, setDbInfo] = useState<{ path: string; size_bytes: number; exists: boolean } | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getStorageSettings()
      .then((s) => {
        if (!cancelled) {
          setBetaChannel(s.betaChannel);
          setStorageSettingsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setStorageSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getVersion()
      .then((v) => {
        if (!cancelled) setAppVersion(v);
      })
      .catch(() => {
        if (!cancelled) setAppVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPathsAndSizes = useCallback(async () => {
    setPathsLoading(true);
    try {
      const [defs, storage] = await Promise.all([
        getStorageDefaultPaths(),
        getStorageSettings(),
      ]);
      setDefaultPaths(defs);

      const resolvedPaths = STORAGE_ITEM_DEFS.map((d) => {
        const custom = storage[d.key as keyof typeof storage];
        if (typeof custom === 'string' && custom.trim()) return custom;
        return defs[d.id as keyof typeof defs] as string;
      });
      setPaths(resolvedPaths);
      setPathsLoading(false);

      if (isDirectorySizeCacheValid(storage.directorySizeCache, resolvedPaths)) {
        setSizes(storage.directorySizeCache.sizes);
        setSizesUpdatedAt(storage.directorySizeCache.updatedAt);
        setSizesLoading(false);
      } else {
        setSizes(EMPTY_SIZES);
        setSizesUpdatedAt(null);
        setSizesLoading(true);
      }

      setSizesRefreshing(true);
      const { sizes: freshSizes } = await getDirectorySizes(resolvedPaths);
      const updatedAt = Date.now();

      setSizes(freshSizes);
      setSizesUpdatedAt(updatedAt);
      setSizesLoading(false);

      await setStorageSettings({
        directorySizeCache: {
          paths: resolvedPaths,
          sizes: freshSizes,
          updatedAt,
        },
      });
    } catch (e) {
      console.warn('[StoragePanel] load paths/sizes failed:', e);
      setPaths([]);
      setSizes(EMPTY_SIZES);
      setSizesUpdatedAt(null);
      setSizesLoading(false);
    } finally {
      setPathsLoading(false);
      setSizesRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPathsAndSizes();
  }, [loadPathsAndSizes]);

  const handleBetaChannelChange = useCallback((checked: boolean) => {
    setBetaChannel(checked);
    void setStorageSettings({ betaChannel: checked });
  }, []);

  const totalSizeBytes = sizes.reduce((a, b) => a + b, 0);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
  };

  const handleOpenFolder = useCallback((path: string) => {
    void openPath(path);
  }, []);

  const handleOpenAppFolder = useCallback(() => {
    if (defaultPaths?.app_base) {
      void openPath(defaultPaths.app_base);
    }
  }, [defaultPaths?.app_base]);

  const handleSetPath = useCallback(
    async (def: StorageItemDef) => {
      const selected = await openFolderDialog({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        await setStorageSettings({ [def.key]: selected });
        await loadPathsAndSizes();
      }
    },
    [loadPathsAndSizes]
  );

  const handleOpenRestoreConfirm = useCallback(() => {
    setRestoreConfirmOpen(true);
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setUpdateChecking(true);
    try {
      const available = await invoke<boolean>('check_update_available');
      setHasUpdate(available);
      setUpdateChecked(true);
      if (available) {
        toast.success(t('updateAvailable'));
      } else {
        toast.success(t('alreadyLatest'));
      }
    } catch (e) {
      toast.error(t('checkUpdateFailed') || '检查更新失败');
      setHasUpdate(false);
      setUpdateChecked(true);
    } finally {
      setUpdateChecking(false);
    }
  }, [t]);

  const handleUpdateNow = useCallback(async () => {
    try {
      await relaunch();
    } catch (e) {
      toast.error(t('updateNowFailed') || '立即更新失败');
    }
  }, [t]);

  const handleConfirmRestore = useCallback(async () => {
    setRestoreSubmitting(true);
    setRestoreConfirmOpen(false);
    try {
      await setStorageSettings({
        cachePath: undefined,
        logsPath: undefined,
      });
      await loadPathsAndSizes();
    } finally {
      setRestoreSubmitting(false);
    }
  }, [loadPathsAndSizes]);

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${Math.round(mb)} MB`;
  };

  // 数据备份：加载数据库信息
  const refreshDbInfo = useCallback(async () => {
    try {
      const info = await invoke<{ path: string; size_bytes: number; exists: boolean }>('get_database_info');
      setDbInfo(info);
    } catch {
      setDbInfo(null);
    }
  }, []);

  useEffect(() => {
    void refreshDbInfo();
  }, [refreshDbInfo]);

  // 导出数据库
  const handleExportDatabase = useCallback(async () => {
    setBackupBusy(true);
    try {
      const targetPath = await invoke<string>('export_database');
      toast.success(`数据已导出到：${targetPath}`);
      await refreshDbInfo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败');
    } finally {
      setBackupBusy(false);
    }
  }, [refreshDbInfo]);

  // 导入数据库（先弹确认框）
  const handleImportDatabase = useCallback(async () => {
    setImportConfirmOpen(false);
    setBackupBusy(true);
    try {
      const msg = await invoke<string>('import_database');
      toast.success(msg);
      // 导入后需重启应用以重建数据库连接
      toast.info('即将重启应用以加载导入的数据');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await relaunch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败');
    } finally {
      setBackupBusy(false);
    }
  }, []);

  const formatUpdatedAt = (timestamp: number) =>
    new Date(timestamp).toLocaleString(undefined, {
      hour12: false,
    });

  return (
    <div className="space-y-6">
      {/* 存储概览 */}
      <SettingCard title={t('storageManagement')} icon={HardDrive}>
        {pathsLoading ? (
          <StoragePanelSkeleton rows={STORAGE_ITEM_DEFS.length} />
        ) : (
          <>
            {/* 总体使用情况 */}
            <div className="p-4 bg-accent/30 rounded-lg mx-2 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('totalStorage')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('used')} {formatSize(totalSizeBytes)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sizesRefreshing
                      ? t('storageRefreshingSizes')
                      : sizesUpdatedAt != null
                        ? t('storageUpdatedAt', { time: formatUpdatedAt(sizesUpdatedAt) })
                        : t('loading')}
                  </p>
                </div>
                <span className="text-lg font-semibold text-foreground">
                  {formatSize(totalSizeBytes)}
                </span>
              </div>
              {!sizesLoading && totalSizeBytes > 0 && (
                <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                  {STORAGE_ITEM_DEFS.map((def, i) => {
                    const pct = totalSizeBytes > 0 ? (sizes[i] ?? 0) / totalSizeBytes : 0;
                    return (
                      <div
                        key={def.id}
                        className={`h-full ${def.color} first:rounded-l-full last:rounded-r-full`}
                        style={{ width: `${pct * 100}%` }}
                        title={`${t(def.nameKey)}: ${formatSize(sizes[i] ?? 0)}`}
                      />
                    );
                  })}
                </div>
              )}
              {!sizesLoading && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                  {STORAGE_ITEM_DEFS.map((def, i) => (
                    <div key={def.id} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${def.color}`} />
                      <span className="text-xs text-muted-foreground">
                        {t(def.nameKey)} ({formatSize(sizes[i] ?? 0)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 存储详情列表 */}
            <div className="space-y-2 px-2 pb-2">
              {STORAGE_ITEM_DEFS.map((def, i) => {
                const Icon = def.icon;
                const path = paths[i] ?? '';
                const sizeBytes = sizes[i] ?? 0;
                return (
                  <div
                    key={def.id}
                    className="flex items-center justify-between p-3 bg-accent/20 rounded-lg group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg ${def.color}/10`}>
                        <Icon className={`w-4 h-4 ${def.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{t(def.nameKey)}</p>
                          <span className="text-xs text-muted-foreground">
                            {sizesLoading ? t('loading') : formatSize(sizeBytes)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate" title={path}>
                          {path}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopyPath(path)}
                        className="p-1.5 rounded hover:bg-accent/50 transition-colors opacity-0 group-hover:opacity-100"
                        title={t('copyPath')}
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleOpenFolder(path)}
                        className="p-1.5 rounded hover:bg-accent/50 transition-colors"
                        title={t('openFolder')}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      {!def.readonly && (
                        <button
                          onClick={() => handleSetPath(def)}
                          className="p-1.5 rounded hover:bg-accent/50 transition-colors"
                          title={t('storageSetPath')}
                        >
                          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 快捷操作 */}
        <div className="flex items-center gap-3 px-2 pt-2 mx-2">
          <button
            onClick={handleOpenAppFolder}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            {t('openAppFolder')}
          </button>
          <button
            onClick={handleOpenRestoreConfirm}
            disabled={pathsLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {t('storageRestoreDefaults')}
          </button>
        </div>
      </SettingCard>

      {/* 恢复默认确认弹窗 */}
      <FormattedDialog
        open={restoreConfirmOpen}
        onOpenChange={setRestoreConfirmOpen}
        minWidth="min-w-[440px]"
        header={{
          icon: RotateCcw,
          title: t('storageRestoreDefaults'),
          description: t('storageRestoreDefaultsConfirm'),
        }}
        contentPadding="p-5"
      >
        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setRestoreConfirmOpen(false)}
            disabled={restoreSubmitting}
          >
            <X className="h-4 w-4 mr-1.5" />
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={() => void handleConfirmRestore()}
            disabled={restoreSubmitting}
          >
            {restoreSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t('storageRestoring')}
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                {t('storageRestoreDefaults')}
              </>
            )}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>

      {/* 数据备份 / 导入 / 导出 */}
      <SettingCard title="数据备份" icon={DatabaseBackup}>
        <div className="space-y-3 p-4 bg-accent/20 rounded-lg mx-2 my-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">本地数据库备份</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                本地版所有环境、分组、标签数据存储于本地 SQLite 数据库。可导出备份到任意位置，或从备份文件导入恢复。
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={refreshDbInfo} disabled={backupBusy}>
              <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
              刷新
            </Button>
          </div>

          {dbInfo && (
            <div className="rounded-md border border-border p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">数据库路径：</span>
                <span className="text-foreground truncate font-mono" title={dbInfo.path}>{dbInfo.path}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileBox className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground shrink-0">文件大小：</span>
                <span className="text-foreground">{formatSize(dbInfo.size_bytes)}</span>
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded ${dbInfo.exists ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
                  {dbInfo.exists ? '存在' : '缺失'}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={handleExportDatabase} disabled={backupBusy}>
              {backupBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
              导出备份
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportConfirmOpen(true)} disabled={backupBusy}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              导入数据
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
            提示：导出会先执行数据检查点确保一致性；导入前会自动备份当前数据（保存为 .pre-import-*.bak），导入完成后需重启应用加载数据。
          </p>
        </div>
      </SettingCard>

      {/* 导入确认弹窗 */}
      <FormattedDialog
        open={importConfirmOpen}
        onOpenChange={setImportConfirmOpen}
        minWidth="min-w-[440px]"
        header={{
          icon: Upload,
          title: '确认导入数据',
          description: '导入将用所选文件替换当前所有本地数据。',
        }}
        contentPadding="p-5"
      >
        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
          导入操作会先自动备份当前数据库，然后用所选备份文件替换。导入完成后应用将自动重启以加载数据。此操作不可撤销，请确认。
        </p>
        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setImportConfirmOpen(false)}
            disabled={backupBusy}
          >
            <X className="h-4 w-4 mr-1.5" />
            取消
          </Button>
          <Button
            size="sm"
            className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0"
            onClick={() => void handleImportDatabase()}
            disabled={backupBusy}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            确认导入
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>

      {/* 版本更新 */}
      <SettingCard title={t('versionUpdate')} icon={Download}>
        <SettingRow icon={FlaskConical} title={t('betaChannel')} description={t('betaChannelDesc')}>
          <Switch
            checked={betaChannel}
            onCheckedChange={handleBetaChannelChange}
            disabled={!storageSettingsLoaded}
          />
        </SettingRow>

        {/* 当前版本 */}
        <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg mx-2 my-2">
          <div>
            <p className="text-sm font-medium text-foreground">{t('currentVersion')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {appVersion != null ? `v${appVersion}` : '—'}
            </p>
          </div>
          {hasUpdate ? (
            <button
              onClick={handleUpdateNow}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary rounded hover:bg-primary/10 transition-colors"
            >
              <RefreshCcw className="w-3 h-3" />
              {t('updateNow')}
            </button>
          ) : (
            <button
              onClick={handleCheckUpdate}
              disabled={updateChecking}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {updateChecking ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('checking')}
                </>
              ) : (
                <>
                  <RefreshCcw className="w-3 h-3" />
                  {updateChecked ? t('alreadyLatest') : t('checkUpdate')}
                </>
              )}
            </button>
          )}
        </div>
      </SettingCard>
    </div>
  );
};
