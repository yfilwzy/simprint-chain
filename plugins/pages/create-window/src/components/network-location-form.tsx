import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  BasicSettings,
  MatchMode,
  GeolocationPrompt,
  AdvancedFingerprintSettings,
} from '../types';
import { CreateWindowProxyDrawer } from './create-window-proxy-drawer';
// @ts-ignore - Cross-plugin import
import { listProxies, type ProxyItem } from '../../../environment-manager/src/api';
// @ts-ignore - Cross-plugin import
import { listProxyChains, type ProxyChainSummary } from '../../../proxy-center/src/api/proxy-chain';

interface NetworkLocationFormProps {
  basicSettings: BasicSettings;
  advancedSettings: AdvancedFingerprintSettings;
  proxyUuids: string[]; // 代理 UUID 列表
  proxyChainId?: string; // 链式代理 ID
  createCount?: number; // 可选，仅在创建模式下使用，用于限制代理选择数量
  onBasicSettingsChange: (value: BasicSettings) => void;
  onAdvancedSettingsChange: (value: AdvancedFingerprintSettings) => void;
  onProxyUuidsChange: (value: string[]) => void; // 更新代理 UUID 列表
  onProxyChainIdChange?: (value: string) => void; // 更新链式代理 ID
}

// 分段控制器组件
function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-all duration-200',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function NetworkLocationForm({
  basicSettings,
  advancedSettings,
  proxyUuids,
  proxyChainId,
  createCount,
  onBasicSettingsChange,
  onAdvancedSettingsChange,
  onProxyUuidsChange,
  onProxyChainIdChange,
}: NetworkLocationFormProps) {
  const { t } = useTranslation('create-window');
  const [proxyDrawerOpen, setProxyDrawerOpen] = useState(false);
  const [allProxies, setAllProxies] = useState<ProxyItem[]>([]);
  const [proxyChains, setProxyChains] = useState<ProxyChainSummary[]>([]);

  // 获取选中的代理信息（用于显示）
  const selectedProxies = useMemo(() => {
    return allProxies.filter((p) => proxyUuids.includes(p.uuid));
  }, [proxyUuids, allProxies]);

  // 加载代理列表（用于匹配）
  useEffect(() => {
    listProxies()
      .then(setAllProxies)
      .catch(() => {
        // 忽略错误
      });
    listProxyChains()
      .then(setProxyChains)
      .catch(() => {
        setProxyChains([]);
      });
  }, []);

  const matchModeOptions = [
    { value: 'ip' as MatchMode, label: t('basicSettings.matchMode.ip') },
    { value: 'custom' as MatchMode, label: t('basicSettings.matchMode.custom') },
  ];

  const geolocationPromptOptions = [
    { value: 'ask' as GeolocationPrompt, label: t('basicSettings.geolocationPromptOptions.ask') },
    {
      value: 'allow' as GeolocationPrompt,
      label: t('basicSettings.geolocationPromptOptions.allow'),
    },
    {
      value: 'forbid' as GeolocationPrompt,
      label: t('basicSettings.geolocationPromptOptions.forbid'),
    },
  ];

  const webrtcOptions = [
    { value: 'replace' as const, label: t('advancedFingerprint.webrtcMode.replace') },
    { value: 'real' as const, label: t('advancedFingerprint.webrtcMode.real') },
    { value: 'disable' as const, label: t('advancedFingerprint.webrtcMode.disable') },
  ];

  return (
    <div className="space-y-4 p-4 border border-border rounded-lg">
      <h3 className="text-sm font-semibold">{t('sections.networkLocation')}</h3>

      {/* 代理IP */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('windowInfo.proxyIp')}</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setProxyDrawerOpen(true)}
          >
            {t('windowInfo.proxyIpActions.set') || '设置'}
          </Button>
        </div>
        {selectedProxies.length > 0 ? (
          <div className="space-y-1">
            {selectedProxies.map((proxy) => (
              <div key={proxy.uuid} className="flex items-center gap-1">
                <div className="flex-1 h-8 px-2 flex items-center text-xs bg-muted rounded overflow-hidden">
                  <span className="truncate">
                    {proxy.host}:{proxy.port}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    onProxyUuidsChange(proxyUuids.filter((uuid) => uuid !== proxy.uuid));
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-8 px-3 flex items-center text-xs text-muted-foreground bg-muted rounded">
            {t('windowInfo.noProxy')}
          </div>
        )}
      </div>

      {/* 链式代理 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">链式代理</Label>
          <span className="text-[10px] text-muted-foreground">多机场优选 → 落地 SOCKS5</span>
        </div>
        <select
          className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={proxyChainId || ''}
          onChange={(event) => {
            const value = event.target.value;
            if (value) {
              onProxyUuidsChange([]);
            }
            onProxyChainIdChange?.(value);
          }}
        >
          <option value="">不使用链式代理</option>
          {proxyChains.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name} · {chain.landing_host || '未配置落地'}:{chain.landing_port || '-'}
            </option>
          ))}
        </select>
        {proxyChainId && (
          <div className="text-[10px] text-amber-600">
            已选择链式代理。启动窗口时会优先使用本地 Mihomo 入口，普通代理选择会被忽略。
          </div>
        )}
      </div>

      {/* WebRTC */}
      <div className="flex items-center justify-between gap-4">
        <Label className="text-xs shrink-0">{t('advancedFingerprint.webrtc')}</Label>
        <SegmentedControl
          value={advancedSettings.webrtc}
          options={webrtcOptions}
          onChange={(v) => onAdvancedSettingsChange({ ...advancedSettings, webrtc: v })}
        />
      </div>

      {/* 语言 & 界面语言 */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.language')}</Label>
          <SegmentedControl
            value={basicSettings.language}
            options={matchModeOptions}
            onChange={(v) => onBasicSettingsChange({ ...basicSettings, language: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.interfaceLanguage')}</Label>
          <SegmentedControl
            value={basicSettings.interfaceLanguage}
            options={matchModeOptions}
            onChange={(v) => onBasicSettingsChange({ ...basicSettings, interfaceLanguage: v })}
          />
        </div>
      </div>

      {/* 时区 & 地理位置 */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.timezone')}</Label>
          <SegmentedControl
            value={basicSettings.timezone}
            options={matchModeOptions}
            onChange={(v) => onBasicSettingsChange({ ...basicSettings, timezone: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0">{t('basicSettings.geolocation')}</Label>
          <SegmentedControl
            value={basicSettings.geolocation}
            options={matchModeOptions}
            onChange={(v) => onBasicSettingsChange({ ...basicSettings, geolocation: v })}
          />
        </div>
      </div>

      {/* 地理位置提示 */}
      <div className="flex items-center justify-between gap-4">
        <Label className="text-xs shrink-0">{t('basicSettings.geolocationPrompt')}</Label>
        <SegmentedControl
          value={basicSettings.geolocationPrompt}
          options={geolocationPromptOptions}
          onChange={(v) => onBasicSettingsChange({ ...basicSettings, geolocationPrompt: v })}
        />
      </div>

      {/* 代理设置抽屉 */}
      <CreateWindowProxyDrawer
        open={proxyDrawerOpen}
        selectedProxyUuids={proxyUuids}
        maxCount={createCount} // 传递最大数量限制
        onOpenChange={setProxyDrawerOpen}
        onConfirm={(newProxyUuids) => {
          onProxyUuidsChange(newProxyUuids);
        }}
      />
    </div>
  );
}
