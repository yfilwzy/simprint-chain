import { invoke } from '@/lib/tauri';

export type ProxyChainStrategy = 'auto_fastest' | 'manual_with_failover' | 'fallback_order';
export type ProxyChainStatus = 'stopped' | 'starting' | 'running' | 'degraded' | 'error';

type MihomoPolicyStrategy = 'select' | 'url_test' | 'fallback' | 'relay';

const DEFAULT_CHAIN_ID = 'default';
const DEFAULT_CHAIN_NAME = '链式代理-落地IP';
const FIRST_HOP_SELECTOR_GROUP = 'PROXY-CHAIN-FIRST-HOP';
const FIRST_HOP_AUTO_GROUP = 'PROXY-CHAIN-AUTO';
const FIRST_HOP_MANUAL_GROUP = 'PROXY-CHAIN-MANUAL';

export interface ProxyNodeHealth {
  name: string;
  provider_id?: string | null;
  delay_ms: number;
  alive: boolean;
  last_checked_at: string;
  error?: string | null;
}

export interface ProxyChainSummary {
  id: string;
  name: string;
  description?: string | null;
  subscriptions_count: number;
  enabled_subscriptions_count: number;
  landing_host: string;
  landing_port: number;
  landing_username?: string | null;
  landing_password_set: boolean;
  strategy: ProxyChainStrategy;
  selected_node?: string | null;
  local_mixed_port?: number | null;
  controller_port?: number | null;
  status: ProxyChainStatus;
  health: ProxyNodeHealth[];
  created_at: string;
  updated_at: string;
}

export interface SubscriptionSafeDetail {
  id: string;
  name: string;
  enabled: boolean;
  url_masked?: string | null;
  include_keywords: string[];
  exclude_keywords: string[];
  last_refreshed_at?: string | null;
  last_error?: string | null;
}

export interface ProxyChainDetail {
  profile: ProxyChainSummary & {
    subscriptions: Array<{
      id: string;
      name: string;
      enabled: boolean;
      include_keywords: string[];
      exclude_keywords: string[];
      last_refreshed_at?: string | null;
      last_error?: string | null;
    }>;
    landing: {
      host: string;
      port: number;
      username?: string | null;
      password_set: boolean;
    };
  };
  subscriptions: SubscriptionSafeDetail[];
}

export interface UpsertProxyChainInput {
  id?: string;
  name: string;
  description?: string;
  subscriptions: Array<{
    id?: string;
    name: string;
    url?: string;
    enabled: boolean;
    include_keywords?: string[];
    exclude_keywords?: string[];
  }>;
  landing: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  strategy: ProxyChainStrategy;
  selected_node?: string;
}

export interface ProxyChainStartResult {
  id: string;
  local_mixed_port: number;
  controller_port: number;
  status: ProxyChainStatus;
  config_path: string;
}

export interface ProxyChainRuntimeInfo {
  id: string;
  status: ProxyChainStatus;
  local_mixed_port?: number | null;
  controller_port?: number | null;
  current_node?: string | null;
  landing_endpoint: string;
  started_at?: string | null;
  last_error?: string | null;
  health: ProxyNodeHealth[];
}

export interface ProxyChainTestResult {
  success: boolean;
  chain_id: string;
  local_proxy?: string | null;
  ip?: string | null;
  country?: string | null;
  city?: string | null;
  latency_ms?: number | null;
  error?: string | null;
}

interface ProxyChainConfig {
  version: number;
  subscriptions: ProxySubscription[];
  landing_socks: LandingSocksConfig[];
  policies: ProxyPolicy[];
  mihomo: MihomoSettings;
  updated_at: string;
}

interface ProxySubscription {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  user_agent?: string | null;
  update_interval_minutes?: number | null;
  include_keywords: string[];
  exclude_keywords: string[];
  nodes: ProxyNode[];
  last_updated_at?: string | null;
  last_error?: string | null;
}

interface ProxyNode {
  id: string;
  name: string;
  enabled: boolean;
  source_subscription_id?: string | null;
  raw: Record<string, unknown>;
}

interface LandingSocksConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  udp: boolean;
  enabled: boolean;
}

interface ProxyPolicy {
  id: string;
  name: string;
  enabled: boolean;
  strategy: MihomoPolicyStrategy;
  node_ids: string[];
  subscription_ids: string[];
  landing_socks_ids: string[];
  test_url?: string | null;
  interval_seconds?: number | null;
  use_direct_fallback: boolean;
}

interface MihomoSettings {
  binary_path?: string | null;
  work_dir?: string | null;
  config_path?: string | null;
  external_controller: string;
  external_controller_secret?: string | null;
  external_ui?: string | null;
  mixed_port?: number | null;
  socks_port?: number | null;
  http_port?: number | null;
  allow_lan: boolean;
  bind_address: string;
  mode: string;
  log_level: string;
  default_test_url: string;
}

interface RuntimeStatus {
  running: boolean;
  pid?: number | null;
  started_at?: string | null;
  config_path?: string | null;
  work_dir?: string | null;
  controller?: string | null;
}

interface SubscriptionUpdateResult {
  subscription_id: string;
  fetched: boolean;
  parsed: number;
  skipped: number;
  updated_at?: string | null;
  error?: string | null;
}

interface MihomoProxyDelayResult {
  name: string;
  success: boolean;
  delay_ms?: number | null;
  error?: string | null;
}

interface ProxyTestCommandResult {
  success: boolean;
  ip_info?: {
    ip?: string;
    country?: string;
    city?: string;
  } | null;
  latency_ms?: number | null;
  error?: string | null;
  message?: string | null;
}

function newId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function commandError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function controllerPort(controller?: string | null) {
  if (!controller) return undefined;
  const normalized = controller.startsWith('http://') || controller.startsWith('https://')
    ? controller
    : `http://${controller}`;
  try {
    const parsed = new URL(normalized);
    return parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    const match = controller.match(/:(\d+)$/);
    return match ? Number(match[1]) : undefined;
  }
}

function toUiStrategy(strategy?: MihomoPolicyStrategy): ProxyChainStrategy {
  switch (strategy) {
    case 'select':
      return 'manual_with_failover';
    case 'fallback':
      return 'fallback_order';
    case 'url_test':
    case 'relay':
    default:
      return 'auto_fastest';
  }
}

function toMihomoStrategy(strategy: ProxyChainStrategy): MihomoPolicyStrategy {
  switch (strategy) {
    case 'manual_with_failover':
      return 'select';
    case 'fallback_order':
      return 'fallback';
    case 'auto_fastest':
    default:
      return 'url_test';
  }
}

function localPort(config: ProxyChainConfig) {
  return config.mihomo.mixed_port || config.mihomo.http_port || null;
}

function isConfigured(config: ProxyChainConfig) {
  return config.subscriptions.length > 0 || config.landing_socks.some((item) => item.enabled);
}

function primaryPolicy(config: ProxyChainConfig): ProxyPolicy {
  return config.policies[0] || {
    id: newId('policy'),
    name: DEFAULT_CHAIN_NAME,
    enabled: true,
    strategy: 'url_test',
    node_ids: [],
    subscription_ids: [],
    landing_socks_ids: [],
    test_url: config.mihomo.default_test_url || 'https://www.gstatic.com/generate_204',
    interval_seconds: 300,
    use_direct_fallback: false,
  };
}

function firstLanding(config: ProxyChainConfig): LandingSocksConfig {
  return config.landing_socks[0] || {
    id: newId('landing'),
    name: '落地 SOCKS5',
    host: '',
    port: 443,
    username: '',
    password: '',
    udp: true,
    enabled: false,
  };
}

function summaryFrom(config: ProxyChainConfig, runtime?: RuntimeStatus): ProxyChainSummary {
  const landing = firstLanding(config);
  const policy = primaryPolicy(config);
  const updated = config.updated_at || new Date().toISOString();
  const running = runtime?.running === true;

  return {
    id: DEFAULT_CHAIN_ID,
    name: policy.name && policy.name !== 'PROXY' ? policy.name : DEFAULT_CHAIN_NAME,
    description: null,
    subscriptions_count: config.subscriptions.length,
    enabled_subscriptions_count: config.subscriptions.filter((item) => item.enabled).length,
    landing_host: landing.host || '',
    landing_port: landing.port || 0,
    landing_username: landing.username || null,
    landing_password_set: Boolean(landing.password && landing.password.trim().length > 0),
    strategy: toUiStrategy(policy.strategy),
    selected_node: null,
    local_mixed_port: running ? localPort(config) : null,
    controller_port: controllerPort(config.mihomo.external_controller) || null,
    status: running ? 'running' : 'stopped',
    health: [],
    created_at: updated,
    updated_at: updated,
  };
}

async function getConfig(redact = true): Promise<ProxyChainConfig> {
  return invoke('proxy_chain_get_config', { redact });
}

async function getRuntime(): Promise<RuntimeStatus> {
  return invoke('proxy_chain_status');
}

export async function listProxyChains(): Promise<ProxyChainSummary[]> {
  const [config, runtime] = await Promise.all([
    getConfig(true),
    getRuntime().catch(() => ({ running: false }) as RuntimeStatus),
  ]);

  return isConfigured(config) ? [summaryFrom(config, runtime)] : [];
}

export async function getProxyChain(_chainId: string): Promise<ProxyChainDetail> {
  const [config, runtime] = await Promise.all([
    getConfig(true),
    getRuntime().catch(() => ({ running: false }) as RuntimeStatus),
  ]);
  const summary = summaryFrom(config, runtime);
  const landing = firstLanding(config);
  const subscriptions = config.subscriptions.map((item) => ({
    id: item.id,
    name: item.name,
    enabled: item.enabled,
    url_masked: item.url,
    include_keywords: item.include_keywords || [],
    exclude_keywords: item.exclude_keywords || [],
    last_refreshed_at: item.last_updated_at || null,
    last_error: item.last_error || null,
  }));

  return {
    profile: {
      ...summary,
      subscriptions: subscriptions.map(({ url_masked: _url, ...item }) => item),
      landing: {
        host: landing.host,
        port: landing.port,
        username: landing.username || null,
        password_set: Boolean(landing.password && landing.password.trim().length > 0),
      },
    },
    subscriptions,
  };
}

export async function upsertProxyChain(input: UpsertProxyChainInput): Promise<ProxyChainDetail> {
  const existing = await getConfig(true);
  const landingId = firstLanding(existing).id || newId('landing');
  const subscriptionInputs = input.subscriptions.length > 0
    ? input.subscriptions
    : existing.subscriptions.map((item) => ({
        id: item.id,
        name: item.name,
        url: item.url,
        enabled: item.enabled,
        include_keywords: item.include_keywords,
        exclude_keywords: item.exclude_keywords,
      }));

  const existingSubscriptions = new Map(existing.subscriptions.map((item) => [item.id, item]));
  const subscriptions: ProxySubscription[] = subscriptionInputs.map((item, index) => {
    const id = item.id || newId('sub');
    const previous = existingSubscriptions.get(id);
    return {
      id,
      name: item.name?.trim() || previous?.name || `机场订阅 ${index + 1}`,
      url: item.url?.trim() || previous?.url || '',
      enabled: item.enabled,
      user_agent: previous?.user_agent || null,
      update_interval_minutes: previous?.update_interval_minutes || 360,
      include_keywords: item.include_keywords || previous?.include_keywords || [],
      exclude_keywords: item.exclude_keywords || previous?.exclude_keywords || [],
      nodes: previous?.nodes || [],
      last_updated_at: previous?.last_updated_at || null,
      last_error: previous?.last_error || null,
    };
  });

  const previousLanding = firstLanding(existing);
  const landing: LandingSocksConfig = {
    id: landingId,
    name: previousLanding.name || '落地 SOCKS5',
    host: input.landing.host?.trim() || previousLanding.host || '',
    port: Number(input.landing.port || previousLanding.port || 443),
    username: input.landing.username?.trim() || previousLanding.username || null,
    password: input.landing.password?.length ? input.landing.password : previousLanding.password || null,
    udp: previousLanding.udp ?? true,
    enabled: Boolean(input.landing.host?.trim() || previousLanding.host),
  };

  const policy: ProxyPolicy = {
    ...primaryPolicy(existing),
    name: input.name?.trim() || DEFAULT_CHAIN_NAME,
    enabled: true,
    strategy: toMihomoStrategy(input.strategy),
    node_ids: [],
    subscription_ids: [],
    landing_socks_ids: [],
    use_direct_fallback: false,
  };

  const config: ProxyChainConfig = {
    ...existing,
    subscriptions,
    landing_socks: [landing],
    policies: [policy],
    mihomo: {
      ...existing.mihomo,
      mixed_port: existing.mihomo.mixed_port || 7890,
      external_controller: existing.mihomo.external_controller || '127.0.0.1:9090',
      bind_address: existing.mihomo.bind_address || '127.0.0.1',
      default_test_url: existing.mihomo.default_test_url || 'https://www.gstatic.com/generate_204',
    },
  };

  await invoke<ProxyChainConfig>('proxy_chain_save_config', { config, redact: true });
  return getProxyChain(DEFAULT_CHAIN_ID);
}

export async function deleteProxyChain(_chainId: string): Promise<void> {
  await invoke('proxy_chain_stop').catch(() => undefined);
  await invoke('proxy_chain_reset_config', { redact: true });
}

export async function startProxyChain(_chainId: string): Promise<ProxyChainStartResult> {
  const status = await invoke<RuntimeStatus>('proxy_chain_start');
  const config = await getConfig(true);
  return {
    id: DEFAULT_CHAIN_ID,
    local_mixed_port: localPort(config) || 7890,
    controller_port: controllerPort(config.mihomo.external_controller) || 9090,
    status: status.running ? 'running' : 'error',
    config_path: status.config_path || '',
  };
}

export async function stopProxyChain(_chainId: string): Promise<void> {
  await invoke('proxy_chain_stop');
}

export async function getProxyChainStatus(_chainId: string): Promise<ProxyChainRuntimeInfo> {
  const [config, runtime] = await Promise.all([getConfig(true), getRuntime()]);
  const landing = firstLanding(config);
  const port = localPort(config);
  return {
    id: DEFAULT_CHAIN_ID,
    status: runtime.running ? 'running' : 'stopped',
    local_mixed_port: runtime.running ? port : null,
    controller_port: controllerPort(config.mihomo.external_controller) || null,
    current_node: null,
    landing_endpoint: landing.host ? `${landing.host}:${landing.port}` : '',
    started_at: runtime.started_at || null,
    last_error: null,
    health: [],
  };
}

function nodeNamesFromConfig(config: ProxyChainConfig) {
  return config.subscriptions
    .filter((subscription) => subscription.enabled)
    .flatMap((subscription) => subscription.nodes.filter((node) => node.enabled).map((node) => node.name))
    .filter(Boolean);
}

export async function measureProxyChainNodes(chainId: string): Promise<ProxyNodeHealth[]> {
  let config = await getConfig(true);
  const runtime = await getRuntime().catch(() => ({ running: false }) as RuntimeStatus);
  if (!runtime.running) {
    await startProxyChain(chainId);
    config = await getConfig(true);
  } else if (nodeNamesFromConfig(config).length === 0) {
    await updateAllProxyChainSubscriptions().catch(() => undefined);
    config = await getConfig(true);
  }
  const names = nodeNamesFromConfig(config);
  const checkedAt = new Date().toISOString();
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        const result = await invoke<MihomoProxyDelayResult>('proxy_chain_test_mihomo_proxy', {
          proxyName: name,
          timeoutMs: 5000,
          testUrl: config.mihomo.default_test_url,
        });
        return {
          name,
          delay_ms: result.success && result.delay_ms != null ? result.delay_ms : -1,
          alive: result.success && result.delay_ms != null,
          last_checked_at: checkedAt,
          error: result.error || null,
        } satisfies ProxyNodeHealth;
      } catch (error) {
        return {
          name,
          delay_ms: -1,
          alive: false,
          last_checked_at: checkedAt,
          error: commandError(error, '测速失败'),
        } satisfies ProxyNodeHealth;
      }
    })
  );

  return results.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return a.delay_ms - b.delay_ms;
  });
}

export async function selectFastestProxyChainNode(chainId: string): Promise<ProxyNodeHealth[]> {
  const health = await measureProxyChainNodes(chainId);
  const fastest = health.find((item) => item.alive);
  if (!fastest) return health;

  await invoke('proxy_chain_select_mihomo_proxy', {
    groupName: FIRST_HOP_MANUAL_GROUP,
    proxyName: fastest.name,
  });
  await invoke('proxy_chain_select_mihomo_proxy', {
    groupName: FIRST_HOP_SELECTOR_GROUP,
    proxyName: FIRST_HOP_MANUAL_GROUP,
  });
  return health;
}

export async function selectAutoFastestProxyChain(): Promise<void> {
  await invoke('proxy_chain_select_mihomo_proxy', {
    groupName: FIRST_HOP_SELECTOR_GROUP,
    proxyName: FIRST_HOP_AUTO_GROUP,
  });
}

export async function updateAllProxyChainSubscriptions(): Promise<SubscriptionUpdateResult[]> {
  return invoke('proxy_chain_update_all_subscriptions');
}

export async function testProxyChain(chainId: string): Promise<ProxyChainTestResult> {
  const config = await getConfig(true);
  if (!(await getRuntime().catch(() => ({ running: false }) as RuntimeStatus)).running) {
    await startProxyChain(chainId);
  }
  const port = localPort(config) || 7890;
  const result = await invoke<ProxyTestCommandResult>('test_proxy', {
    config: {
      proxy_type: 'http',
      host: '127.0.0.1',
      port,
      username: null,
      password: null,
    },
  });

  return {
    success: result.success,
    chain_id: chainId,
    local_proxy: `127.0.0.1:${port}`,
    ip: result.ip_info?.ip || null,
    country: result.ip_info?.country || null,
    city: result.ip_info?.city || null,
    latency_ms: result.latency_ms || null,
    error: result.error || result.message || null,
  };
}
