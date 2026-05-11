import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Trash2,
  RefreshCw,
  ExternalLink,
  Info,
  ShieldCheck,
  Ban,
  Play,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DataTableRowContainer,
  DataTableCell,
  DataTableCheckboxCell,
  DataTableActionsCell,
} from '@/components/data-table';
import type { ExtensionItem } from '../types';
import { ExtensionIcon } from './extension-icon';

interface ExtensionTableRowProps {
  extension: ExtensionItem;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onUpdate?: (id: string) => void;
  onUninstall?: (id: string, name: string) => void;
  onViewDetails?: (id: string) => void;
  onHomepage?: (id: string) => void;
  onSecurityCheck?: (id: string) => void;
  onDisable?: (id: string, name: string) => void;
  onEnable?: (id: string, name: string) => void;
}

export function ExtensionTableRow({
  extension,
  isSelected = false,
  onSelect,
  onUpdate,
  onUninstall,
  onViewDetails,
  onHomepage,
  onSecurityCheck,
  onDisable,
  onEnable,
}: ExtensionTableRowProps) {
  const { t } = useTranslation('extensions');

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = () => {
    switch (extension.status) {
      case 'active':
      case 'installed':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            {t('status.installed')}
          </span>
        );
      case 'update':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-amber-500/10 text-amber-500 border-amber-500/30">
            <AlertCircle className="h-3 w-3" />
            {t('status.update')}
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase border bg-gray-500/10 text-gray-500 border-gray-500/30">
            <Ban className="h-3 w-3" />
            {t('status.disabled')}
          </span>
        );
      default:
        return null;
    }
  };

  const getBrowserBadge = () => {
    const colors: Record<string, string> = {
      chrome: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600',
      firefox: 'border-orange-500/30 bg-orange-500/10 text-orange-500',
      edge: 'border-blue-500/30 bg-blue-500/10 text-blue-500',
      all: 'border-purple-500/30 bg-purple-500/10 text-purple-500',
    };
    const labels: Record<string, string> = {
      chrome: 'Chrome',
      firefox: 'Firefox',
      edge: 'Edge',
      all: t('browser.all'),
    };
    return (
      <span className={`text-[10px] border px-2 py-0.5 font-bold ${colors[extension.browser]}`}>
        {labels[extension.browser]}
      </span>
    );
  };

  return (
    <DataTableRowContainer isSelected={isSelected}>
      {/* 选择框列 */}
      <DataTableCheckboxCell
        isSelected={isSelected}
        onSelect={(selected) => onSelect?.(extension.id, selected)}
      />

      {/* 名称列 */}
      <DataTableCell>
        <div className="font-bold flex items-center gap-2 min-w-0">
          <ExtensionIcon
            icon={extension.icon}
            source={extension.source}
            containerClassName="h-5 w-5 rounded"
            imageClassName="rounded"
            textClassName="text-lg"
            fallbackClassName="h-4 w-4"
          />
          <span className="max-w-[150px] truncate">{extension.name}</span>
          {extension.source === 'local' && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase border rounded border-sky-500/30 bg-sky-500/10 text-sky-600">
              {t('local.badge')}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-xs">
          {extension.description}
        </div>
      </DataTableCell>

      {/* 状态列 */}
      <DataTableCell>{getStatusBadge()}</DataTableCell>

      {/* 浏览器列 */}
      <DataTableCell>{getBrowserBadge()}</DataTableCell>

      {/* 分组列 */}
      <DataTableCell>
        {extension.groups && extension.groups.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {extension.groups.map((group) => (
              <span
                key={group.uuid}
                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                title={group.name}
              >
                {group.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">-</span>
        )}
      </DataTableCell>

      {/* 下载量列 */}
      <DataTableCell>
        <span className="font-mono text-[11px] text-muted-foreground">
          {extension.downloads?.toLocaleString() || '-'}
        </span>
      </DataTableCell>

      {/* 更新时间列 */}
      <DataTableCell className="text-xs text-muted-foreground font-mono">
        {formatDate(extension.updatedAt)}
      </DataTableCell>

      {/* 操作列 */}
      <DataTableActionsCell isSelected={isSelected}>
        {/* 安全检查 */}
        <button
          onClick={() => onSecurityCheck?.(extension.id)}
          className="h-7 w-7 flex items-center justify-center cursor-pointer transition-all border bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
          title={t('table.actions.securityCheck')}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
        </button>
        {/* 检查更新 */}
        <button
          onClick={() => onUpdate?.(extension.id)}
          className={`h-7 w-7 flex items-center justify-center cursor-pointer transition-all border ${
            extension.status === 'update'
              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-secondary text-muted-foreground border-border hover:bg-accent hover:text-foreground'
          }`}
          title={t('table.actions.checkUpdate')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        {/* 更多操作 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-7 w-7 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent"
              title={t('table.actions.more')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => onViewDetails?.(extension.id)}
              className="cursor-pointer"
            >
              <Info className="w-4 h-4 mr-2" />
              <span>{t('table.actions.details')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onHomepage?.(extension.id)}
              className="cursor-pointer"
              disabled={false}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              <span>{t('table.actions.homepage')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* 只有团队插件才显示禁用/启用选项 */}
            {extension.scope === 'team' && (
              <>
                {extension.status === 'disabled' ? (
                  <DropdownMenuItem
                    onClick={() => onEnable?.(extension.id, extension.name)}
                    className="cursor-pointer"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    <span>{t('table.actions.enable')}</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onDisable?.(extension.id, extension.name)}
                    className="cursor-pointer"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    <span>{t('table.actions.disable')}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => onUninstall?.(extension.id, extension.name)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              <span>{t('table.actions.uninstall')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DataTableActionsCell>
    </DataTableRowContainer>
  );
}
