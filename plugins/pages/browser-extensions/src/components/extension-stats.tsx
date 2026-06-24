import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Puzzle, CheckCircle2, AlertCircle, Download, RefreshCw } from 'lucide-react';

interface ExtensionStatsProps {
  total: number;
  installed: number;
  updates: number;
  available: number;
  scopeFilter?: string;
  onScopeFilterChange?: (value: string) => void;
  onRefresh: () => void;
}

export function ExtensionStats({
  total,
  installed,
  updates,
  available,
  scopeFilter = 'all',
  onScopeFilterChange,
  onRefresh,
}: ExtensionStatsProps) {
  const { t } = useTranslation('extensions');

  return (
    <div className="flex min-h-14 items-center gap-6 px-4 py-3 border-b border-border bg-secondary/30">
      <div className="flex items-center gap-2">
        <Puzzle className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">{t('stats.total')}</span>
        <span className="text-xs font-bold text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <span className="text-xs text-muted-foreground">{t('stats.installed')}</span>
        <span className="text-xs font-bold text-emerald-500">{installed}</span>
      </div>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <span className="text-xs text-muted-foreground">{t('stats.updates')}</span>
        <span className="text-xs font-bold text-amber-500">{updates}</span>
      </div>
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-blue-500" />
        <span className="text-xs text-muted-foreground">{t('stats.available')}</span>
        <span className="text-xs font-bold text-blue-500">{available}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Tabs value={scopeFilter} onValueChange={onScopeFilterChange}>
          <TabsList className="h-7 bg-secondary">
            <TabsTrigger value="all" className="text-[10px] px-2.5 h-6">
              {t('tabs.all')}
            </TabsTrigger>
            <TabsTrigger value="team" className="text-[10px] px-2.5 h-6">
              {t('tabs.team')}
            </TabsTrigger>
            <TabsTrigger value="personal" className="text-[10px] px-2.5 h-6">
              {t('tabs.personal')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <button
          onClick={onRefresh}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title={t('stats.refresh')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
