import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Activity, Gauge, Play, RefreshCcw, Route, Save, ShieldCheck, Square, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  deleteProxyChain,
  listProxyChains,
  measureProxyChainNodes,
  selectFastestProxyChainNode,
  startProxyChain,
  stopProxyChain,
  testProxyChain,
  upsertProxyChain,
  type ProxyChainStrategy,
  updateAllProxyChainSubscriptions,
  type ProxyChainSummary,
  type ProxyNodeHealth,
} from '../api/proxy-chain';

interface ChainFormState {
  id?: string;
  name: string;
  description: string;
  strategy: ProxyChainStrategy;
  subscriptionLines: string;
  landingHost: string;
  landingPort: string;
  landingUsername: string;
  landingPassword: string;
}

const emptyForm: ChainFormState = {
  name: '链式代理-落地IP',
  description: '',
  strategy: 'auto_fastest',
  subscriptionLines: '',
  landingHost: '',
  landingPort: '443',
  landingUsername: '',
  landingPassword: '',
};

function statusColor(status: ProxyChainSummary['status']) {
  switch (status) {
    case 'running': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    case 'degraded': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    case 'error': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'starting': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function parseSubscriptionLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawName, ...urlParts] = line.split('|');
      const url = urlParts.join('|').trim();
      return {
        name: (url ? rawName : `订阅 ${index + 1}`).trim(),
        url: url || rawName.trim(),
        enabled: true,
      };
    });
}

function healthSummary(health: ProxyNodeHealth[]) {
  if (!health.length) return '尚未测速';
  const alive = health.filter((item) => item.alive).length;
  const best = health.find((item) => item.alive);
  return best ? `${alive}/${health.length} 可用，最快 ${best.delay_ms}ms` : `0/${health.length} 可用`;
}

export function ProxyChainPanel() {
  const [chains, setChains] = useState<ProxyChainSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ChainFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [healthByChain, setHealthByChain] = useState<Record<string, ProxyNodeHealth[]>>({});
  const displayedChains = useMemo(
    () => chains.map((chain) => ({ ...chain, health: healthByChain[chain.id] || chain.health })),
    [chains, healthByChain]
  );
  const selected = useMemo(() => chains.find((chain) => chain.id === selectedId), [chains, selectedId]);
  const selectedHealth = selectedId ? healthByChain[selectedId] || selected?.health || [] : [];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listProxyChains();
      setChains(items);
      if (!selectedId && items[0]) setSelectedId(items[0].id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载链式代理失败');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      id: selected.id,
      name: selected.name,
      description: selected.description || '',
      strategy: selected.strategy,
      landingHost: selected.landing_host,
      landingPort: String(selected.landing_port),
      landingUsername: selected.landing_username || '',
      landingPassword: '',
      subscriptionLines: '',
    }));
  }, [selected]);

  const save = async () => {
    const subscriptions = parseSubscriptionLines(form.subscriptionLines);
    if (!form.id && subscriptions.length === 0) {
      toast.error('请至少填写一个机场订阅，每行格式：名称|订阅URL');
      return;
    }
    setBusy(true);
    try {
      await upsertProxyChain({
        id: form.id,
        name: form.name,
        description: form.description || undefined,
        strategy: form.strategy,
        subscriptions: subscriptions.length ? subscriptions : selected?.health ? [] : subscriptions,
        landing: {
          host: form.landingHost,
          port: Number(form.landingPort),
          username: form.landingUsername || undefined,
          password: form.landingPassword || undefined,
        },
      });
      toast.success('链式代理已保存');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const measureAndStore = async (chainId: string, selectFastest = false) => {
    setBusy(true);
    try {
      const health = selectFastest
        ? await selectFastestProxyChainNode(chainId)
        : await measureProxyChainNodes(chainId);
      setHealthByChain((prev) => ({ ...prev, [chainId]: health }));
      const alive = health.filter((item) => item.alive);
      const fastest = alive[0];
      toast.success(
        fastest
          ? `${selectFastest ? '已选择最快节点' : '测速完成'}：${fastest.name} ${fastest.delay_ms}ms`
          : '测速完成：暂无可用节点（延迟均为 -1）'
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '测速失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-background">
      <aside className="w-80 border-r border-border p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><Route className="h-4 w-4" />链式代理</h2>
            <p className="text-xs text-muted-foreground mt-1">多机场优选 → 落地 SOCKS5</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}><RefreshCcw className="h-3.5 w-3.5" /></Button>
        </div>
        <Button className="w-full" size="sm" variant="secondary" onClick={() => { setSelectedId(null); setForm(emptyForm); }}>
          新建链式代理
        </Button>
        <div className="space-y-2">
          {displayedChains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedId(chain.id)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedId === chain.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{chain.name}</span>
                <Badge variant="outline" className={statusColor(chain.status)}>{chain.status}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground space-y-1">
                <div>{chain.enabled_subscriptions_count}/{chain.subscriptions_count} 个订阅启用</div>
                <div>落地：{chain.landing_host}:{chain.landing_port}</div>
                <div>本地：{chain.local_mixed_port ? `127.0.0.1:${chain.local_mixed_port}` : '未启动'}</div>
                <div>{healthSummary(chain.health)}</div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />链路配置</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select value={form.strategy} onValueChange={(value) => setForm({ ...form, strategy: value as ProxyChainStrategy })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_fastest">自动最快</SelectItem>
                  <SelectItem value="manual_with_failover">手动 + 故障切换</SelectItem>
                  <SelectItem value="fallback_order">顺序 fallback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="备注" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-4 gap-3">
              <Input className="col-span-2" placeholder="落地 SOCKS5 Host" value={form.landingHost} onChange={(e) => setForm({ ...form, landingHost: e.target.value })} />
              <Input placeholder="端口" value={form.landingPort} onChange={(e) => setForm({ ...form, landingPort: e.target.value })} />
              <Input placeholder="用户名" value={form.landingUsername} onChange={(e) => setForm({ ...form, landingUsername: e.target.value })} />
            </div>
            <Input type="password" placeholder={selected?.landing_password_set ? '已保存密码；留空则保持不变' : '落地 SOCKS5 密码'} value={form.landingPassword} onChange={(e) => setForm({ ...form, landingPassword: e.target.value })} />
            <Textarea
              className="min-h-28 font-mono text-xs"
              placeholder={'机场订阅，每行一个：名称|订阅URL\n例如：机场A|https://example.com/sub?token=***'}
              value={form.subscriptionLines}
              onChange={(e) => setForm({ ...form, subscriptionLines: e.target.value })}
            />
            {selected && (
              <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground mb-2">已保存订阅（脱敏展示）</div>
                {selected.subscriptions_count ? `${selected.subscriptions_count} 个订阅已保存。更新时如不填写订阅 URL，会保持现有凭据。` : '暂无订阅'}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={save} disabled={busy}><Save className="h-3.5 w-3.5 mr-1.5" />保存</Button>
              {selected && <Button size="sm" variant="outline" onClick={() => runAction(() => updateAllProxyChainSubscriptions(), '订阅同步完成')} disabled={busy}><RefreshCcw className="h-3.5 w-3.5 mr-1.5" />同步订阅</Button>}
              {selected && <Button size="sm" variant="outline" onClick={() => runAction(() => startProxyChain(selected.id), '链式代理已启动')} disabled={busy}><Play className="h-3.5 w-3.5 mr-1.5" />启动</Button>}
              {selected && <Button size="sm" variant="outline" onClick={() => runAction(() => stopProxyChain(selected.id), '链式代理已停止')} disabled={busy}><Square className="h-3.5 w-3.5 mr-1.5" />停止</Button>}
              {selected && <Button size="sm" variant="outline" onClick={() => measureAndStore(selected.id)} disabled={busy}><Gauge className="h-3.5 w-3.5 mr-1.5" />测速</Button>}
              {selected && <Button size="sm" variant="outline" onClick={() => measureAndStore(selected.id, true)} disabled={busy}><Zap className="h-3.5 w-3.5 mr-1.5" />选择最快</Button>}
              {selected && <Button size="sm" variant="outline" onClick={() => runAction(async () => {
                const result = await testProxyChain(selected.id);
                if (!result.success) throw new Error(result.error || '链路测试失败');
                toast.success(`出口 IP：${result.ip || '未知'} ${result.country || ''} ${result.city || ''}`);
              }, '链路测试完成')} disabled={busy}><Activity className="h-3.5 w-3.5 mr-1.5" />出口检测</Button>}
              {selected && <Button size="sm" variant="destructive" onClick={() => runAction(() => deleteProxyChain(selected.id), '已删除链式代理')} disabled={busy}><Trash2 className="h-3.5 w-3.5 mr-1.5" />删除</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">节点延迟</CardTitle></CardHeader>
          <CardContent>
            {selectedHealth.length ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                {selectedHealth.slice(0, 120).map((item) => (
                  <div key={item.name} className="rounded-md border border-border p-2 text-xs flex items-center justify-between gap-2">
                    <span className="truncate" title={item.name}>{item.name}</span>
                    <Badge variant="outline" className={item.alive ? 'text-emerald-600' : 'text-destructive'}>
                      {item.alive ? `${item.delay_ms}ms` : '-1'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">启动后点击“测速”或“选择最快”，这里会展示节点延迟。延迟 -1 会被视为不可用。</div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
