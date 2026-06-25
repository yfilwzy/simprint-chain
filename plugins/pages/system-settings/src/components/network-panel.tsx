import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Cloud, CloudOff, RefreshCw, CloudUpload, Clock, Network, Play, Square, ExternalLink, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/tauri';
import { SettingCard } from './setting-card';
import { SettingRow } from './setting-row';
import {
  getNetworkSettings,
  setNetworkSettings,
  SYNC_INTERVAL_OPTIONS,
} from '../../../../services/store/src';

interface ProxyChainRuntimeStatus {
  running: boolean;
  pid?: number | null;
  started_at?: string | null;
  config_path?: string | null;
  work_dir?: string | null;
  controller?: string | null;
}

/**
 * 网络与同步面板
 *
 * 「网络代理」部分对接代理中心（Mihomo 链式代理体系）：
 * - 显示代理中心运行状态
 * - 提供启停按钮（调用 proxy_chain_start / proxy_chain_stop）
 * - 提供跳转代理中心配置入口
 * 「数据同步」部分保留原有的本地存储配置。
 */
export const NetworkPanel: React.FC = () => {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const [proxyRunning, setProxyRunning] = useState(false);
  const [proxyController, setProxyController] = useState<string | null>(null);
  const [proxyBusy, setProxyBusy] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(30);
  const [networkSettingsLoaded, setNetworkSettingsLoaded] = useState(false);

  // 加载代理中心运行状态
  const refreshProxyStatus = useCallback(async () => {
    try {
      const status = await invoke<ProxyChainRuntimeStatus>('proxy_chain_status');
      setProxyRunning(Boolean(status?.running));
      setProxyController(status?.controller || null);
    } catch {
      setProxyRunning(false);
      setProxyController(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getNetworkSettings()
      .then((s) => {
        if (!cancelled) {
          setAutoSync(s.autoSync);
          setSyncInterval(s.syncInterval);
          setNetworkSettingsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNetworkSettingsLoaded(true);
      });
    void refreshProxyStatus();
    // 定时刷新代理状态（每 10 秒）
    const timer = setInterval(() => { void refreshProxyStatus(); }, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshProxyStatus]);

  const handleStartProxy = useCallback(async () => {
    setProxyBusy(true);
    try {
      await invoke('proxy_chain_start');
      await refreshProxyStatus();
    } catch (error) {
      console.error('启动代理中心失败', error);
    } finally {
      setProxyBusy(false);
    }
  }, [refreshProxyStatus]);

  const handleStopProxy = useCallback(async () => {
    setProxyBusy(true);
    try {
      await invoke('proxy_chain_stop');
      await refreshProxyStatus();
    } catch (error) {
      console.error('停止代理中心失败', error);
    } finally {
      setProxyBusy(false);
    }
  }, [refreshProxyStatus]);

  const handleAutoSyncChange = useCallback((checked: boolean) => {
    setAutoSync(checked);
    void setNetworkSettings({ autoSync: checked });
  }, []);

  const handleSyncIntervalChange = useCallback((value: string) => {
    const num = Number(value);
    setSyncInterval(num);
    void setNetworkSettings({ syncInterval: num });
  }, []);

  return (
    <div className="space-y-6">
      {/* 网络代理 —— 对接代理中心 */}
      <SettingCard title={t('networkProxy')} icon={Network}>
        <div className="space-y-3 p-4 bg-accent/20 rounded-lg mx-2 my-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">代理中心状态</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                由代理中心统一管理 Mihomo 链式代理（机场订阅直连 / 机场订阅加落地代理）
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${proxyRunning ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
              <span className={`text-xs font-medium ${proxyRunning ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                {proxyRunning ? '运行中' : '已停止'}
              </span>
            </div>
          </div>

          {proxyController && proxyRunning && (
            <div className="text-xs text-muted-foreground">
              控制器：{proxyController}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {proxyRunning ? (
              <Button size="sm" variant="outline" onClick={handleStopProxy} disabled={proxyBusy}>
                <Square className="h-3.5 w-3.5 mr-1.5" />
                停止代理
              </Button>
            ) : (
              <Button size="sm" onClick={handleStartProxy} disabled={proxyBusy}>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                启动代理
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={refreshProxyStatus} disabled={proxyBusy}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              刷新状态
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/proxy')}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              前往代理中心配置
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* 连接状态 */}
        <div className="flex items-center justify-between p-4 bg-accent/30 rounded-lg mx-2 my-2">
          <div>
            <p className="text-sm font-medium text-foreground">{t('networkStatus')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('networkStatusDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${proxyRunning ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
            <span className={`text-xs font-medium ${proxyRunning ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              {proxyRunning ? t('connected') : '未连接'}
            </span>
          </div>
        </div>
      </SettingCard>

      {/* 数据同步 */}
      <SettingCard title={t('dataSync')} icon={autoSync ? Cloud : CloudOff}>
        <SettingRow icon={CloudUpload} title={t('autoSync')} description={t('autoSyncDesc')}>
          <Switch
            checked={autoSync}
            onCheckedChange={handleAutoSyncChange}
            disabled={!networkSettingsLoaded}
          />
        </SettingRow>

        {autoSync && (
          <div className="flex items-center justify-between p-3 ml-7 bg-accent/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{t('syncInterval')}</span>
            </div>
            <Select
              value={String(syncInterval)}
              onValueChange={handleSyncIntervalChange}
              disabled={!networkSettingsLoaded}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVAL_OPTIONS.map((min) => (
                  <SelectItem key={min} value={String(min)}>
                    {min === 60 ? t('syncIntervalHour') : t('syncIntervalMinutes', { count: min })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SettingCard>
    </div>
  );
};
