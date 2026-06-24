import { useTranslation } from 'react-i18next';
import { ExternalLink, Globe, Star, Download, User, Code, Monitor } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ExtensionItem } from '../types';
import { getExtensionHomepageUrl } from '../utils/chrome-store';
import { ExtensionIcon } from './extension-icon';

interface ExtensionHomepageDialogProps {
  open: boolean;
  extension: ExtensionItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 访问主页确认对话框组件
 */
export function ExtensionHomepageDialog({
  open,
  extension,
  onOpenChange,
}: ExtensionHomepageDialogProps) {
  const { t } = useTranslation('extensions');

  // 获取实际的主页 URL（如果有 homepage 则使用，否则使用 Chrome Web Store URL）
  const homepageUrl = extension ? getExtensionHomepageUrl(extension.id, extension.homepage) : null;

  const handleConfirm = async () => {
    if (!homepageUrl) return;
    try {
      await openUrl(homepageUrl);
      onOpenChange(false);
    } catch (e) {
      console.error('Failed to open URL:', e);
    }
  };

  if (!extension) return null;

  const browserLabels: Record<string, string> = {
    chrome: t('browser.chrome'),
    firefox: t('browser.firefox'),
    edge: t('browser.edge'),
    all: t('browser.all'),
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[600px]"
      header={{
        icon: Globe,
        iconColor: 'text-blue-500',
        title: t('dialog.homepage.title'),
        description: t('dialog.homepage.description', { name: extension.name }),
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
        className: 'border-b border-blue-500/20',
      }}
      contentPadding="p-5"
    >
      <div className="space-y-4">
        {/* 插件基本信息 */}
        <div className="bg-muted/50 rounded-md p-4 border border-border/50">
          <div className="flex items-start gap-3">
            <ExtensionIcon
              icon={extension.icon}
              source={extension.source}
              containerClassName="h-12 w-12 rounded bg-muted flex-shrink-0"
              imageClassName="rounded"
              fallbackClassName="h-6 w-6"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground mb-1">{extension.name}</h4>
              {extension.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {extension.description}
                </p>
              )}

              {/* 版本和浏览器显示在名称下方 */}
              <div className="flex items-center gap-4 mt-2">
                {extension.version && (
                  <div className="flex items-center gap-1.5">
                    <Code className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{extension.version}</span>
                  </div>
                )}
                {extension.browser && (
                  <div className="flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {browserLabels[extension.browser] || extension.browser}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 详细信息网格 */}
          {extension.author && extension.rating && extension.downloads && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
              {extension.author && (
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{t('table.headers.author')}</div>
                    <div className="text-xs font-medium text-foreground truncate">
                      {extension.author}
                    </div>
                  </div>
                </div>
              )}

              {extension.rating !== undefined && (
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{t('store.sort.rating')}</div>
                    <div className="text-xs font-medium text-foreground">
                      {extension.rating.toFixed(1)} / 5.0
                    </div>
                  </div>
                </div>
              )}

              {extension.downloads !== undefined && (
                <div className="flex items-center gap-2">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {t('table.headers.downloads')}
                    </div>
                    <div className="text-xs font-medium text-foreground">
                      {extension.downloads.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 主页链接 - 显示在卡片内 */}
          {homepageUrl && (
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                {t('dialog.homepage.url')}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-muted-foreground truncate flex-1 w-44 overflow-hidden">
                    {homepageUrl}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-md break-all">{homepageUrl}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 警告提示 */}
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 p-3 rounded-md">
          <ExternalLink className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{t('dialog.homepage.warning')}</span>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          {t('dialog.homepage.cancel')}
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={!homepageUrl}>
          <ExternalLink className="h-4 w-4 mr-1.5" />
          {t('dialog.homepage.confirm')}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
