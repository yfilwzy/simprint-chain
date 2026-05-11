import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Check, Download, Users, Folder, Search } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { TextareaInput } from '@/components/textarea-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { StoreExtension } from '../types';
import { ExtensionIcon } from './extension-icon';

// 分组项类型
interface GroupItem {
  uuid: string;
  name: string;
  description?: string;
}

interface ExtensionInstallDialogProps {
  open: boolean;
  extension: StoreExtension | null;
  groups: GroupItem[];
  loadingGroups?: boolean;
  installGroups: string[];
  installForTeam: boolean;
  installing: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupToggle: (group: string) => void;
  onTeamChange: (forTeam: boolean) => void;
  onConfirm: () => void;
}

// 分组卡片组件
const GroupCard: React.FC<{
  group: GroupItem;
  isSelected: boolean;
  onClick: () => void;
}> = ({ group, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors duration-150 ${
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/80'
      }`}
    >
      <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-muted text-muted-foreground group-hover:text-foreground transition-colors duration-150">
        <Folder className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{group.name}</span>
        </div>
        {group.description && (
          <div className="mt-0.5 text-xs text-muted-foreground truncate">{group.description}</div>
        )}
      </div>
      <div
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
          isSelected
            ? 'bg-primary border-primary'
            : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
        }`}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
    </div>
  );
};

// 加载状态组件
const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-10">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

// 空状态组件
const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <Folder className="h-8 w-8 text-purple-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[260px]">{description}</p>
  </div>
);

/**
 * 扩展安装对话框组件
 */
export function ExtensionInstallDialog({
  open,
  extension,
  groups,
  loadingGroups = false,
  installGroups,
  installForTeam,
  installing,
  onOpenChange,
  onGroupToggle,
  onTeamChange,
  onConfirm,
}: ExtensionInstallDialogProps) {
  const { t } = useTranslation('extensions');
  const [searchQuery, setSearchQuery] = useState('');

  // 过滤分组
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    );
  }, [groups, searchQuery]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchQuery('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={handleOpenChange}
      header={{
        icon: Download,
        title: t('dialog.install.title'),
        description: t('dialog.install.description'),
        gradient: 'bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10',
        iconColor: 'text-purple-500',
      }}
      contentClassName="space-y-3"
    >
      {extension && (
        <>
          {/* 插件信息卡片 */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="w-11 h-11 rounded-lg bg-background border border-border/50 flex items-center justify-center shrink-0">
              <ExtensionIcon
                icon={extension.icon}
                source={extension.source}
                containerClassName="h-10 w-10 rounded-lg"
                imageClassName="rounded-lg"
                fallbackClassName="h-6 w-6"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate">{extension.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground font-mono">
                  v{extension.version}
                </span>
                {extension.author && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {extension.author}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 分组选择区域 */}
          {loadingGroups ? (
            <LoadingState />
          ) : groups.length > 0 ? (
            <>
              {/* 搜索框 - 只在分组数量较多时显示 */}
              {groups.length > 4 && (
                <div className="relative flex items-center">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <TextareaInput
                    placeholder={t('dialog.install.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-2 text-sm min-h-9"
                  />
                </div>
              )}

              {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <p className="text-sm text-muted-foreground">{t('dialog.install.noMatch')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[160px] -mx-1 px-1">
                  <div className="space-y-1.5">
                    {filteredGroups.map((group) => (
                      <GroupCard
                        key={group.uuid}
                        group={group}
                        isSelected={installGroups.includes(group.uuid)}
                        onClick={() => onGroupToggle(group.uuid)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          ) : (
            <EmptyState
              title={t('dialog.install.noGroups')}
              description={t('dialog.install.noGroupsDescription')}
            />
          )}

          {/* 团队安装开关 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label className="text-xs font-medium cursor-pointer">
                  {t('dialog.install.teamInstall')}
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {installGroups.length > 0
                    ? t('dialog.install.teamInstallDescriptionForGroup')
                    : t('dialog.install.teamInstallDescription')}
                </p>
              </div>
            </div>
            <Switch checked={installForTeam} onCheckedChange={onTeamChange} />
          </div>
        </>
      )}

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onOpenChange(false)}
          disabled={installing}
        >
          {t('dialog.install.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={onConfirm}
          disabled={installing}
        >
          {installing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.install.installing')}
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {installGroups.length > 0
                ? t('dialog.install.confirmWithCount', { count: installGroups.length })
                : t('dialog.install.confirm')}
            </>
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
