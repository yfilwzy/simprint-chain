import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Info, Package, Shield, Download, Star, Calendar } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getExtensionDetail } from '../api';
import type { Extension } from '../api';
import type { ExtensionItem } from '../types';
import { ExtensionIcon } from './extension-icon';

interface ExtensionDetailDialogProps {
  open: boolean;
  extension: ExtensionItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 扩展详情对话框组件
 */
export function ExtensionDetailDialog({
  open,
  extension,
  onOpenChange,
}: ExtensionDetailDialogProps) {
  const { t } = useTranslation('extensions');
  const knownCategories = new Set([
    'automation',
    'security',
    'productivity',
    'tools',
    'media',
    'social',
  ]);
  const [remoteState, setRemoteState] = useState<{
    key: string | null;
    detail: Extension | null;
    error: string | null;
  }>({
    key: null,
    detail: null,
    error: null,
  });

  const remoteExtensionKey =
    open && extension && extension.source !== 'local'
      ? extension.extensionId || extension.id
      : null;

  const localExtensionDetail =
    open && extension?.source === 'local'
      ? {
          id: extension.id,
          recordId: extension.recordId,
          extensionId: extension.extensionId || extension.id,
          source: 'local' as const,
          name: extension.name,
          description: extension.description,
          version: extension.version,
          category: extension.category,
          browser: extension.browser,
          author: extension.author,
          homepage: extension.homepage,
          icon: extension.icon,
          downloadUrl: undefined,
          fileSize: extension.fileSize,
          downloads: extension.downloads,
          permissions: extension.permissions,
          status: extension.status,
          rating: extension.rating,
          updatedAt: extension.updatedAt,
          createdAt: extension.createdAt,
          hash: extension.hash,
          scope: extension.scope,
          groups: extension.groups,
        }
      : null;

  const hasMatchingRemoteDetail =
    remoteExtensionKey !== null &&
    remoteState.detail !== null &&
    remoteState.key === remoteExtensionKey;
  const hasMatchingRemoteError =
    remoteExtensionKey !== null && remoteState.key === remoteExtensionKey;
  const loading =
    remoteExtensionKey !== null && !hasMatchingRemoteDetail && !hasMatchingRemoteError;
  const error = hasMatchingRemoteError ? remoteState.error : null;

  useEffect(() => {
    if (!remoteExtensionKey || hasMatchingRemoteDetail) {
      return;
    }

    getExtensionDetail(remoteExtensionKey)
      .then((data) => {
        setRemoteState({
          key: remoteExtensionKey,
          detail: data,
          error: null,
        });
      })
      .catch((e) => {
        setRemoteState({
          key: remoteExtensionKey,
          detail: null,
          error: e instanceof Error ? e.message : '获取扩展详情失败',
        });
      });
  }, [hasMatchingRemoteDetail, remoteExtensionKey]);

  const extensionDetail =
    localExtensionDetail || (hasMatchingRemoteDetail ? remoteState.detail : null);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatCategory = (category?: string) => {
    if (!category) return t('store.categories.all');
    return knownCategories.has(category) ? t(`store.categories.${category}`) : category;
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[600px]"
      header={{
        icon: Info,
        iconColor: 'text-blue-500',
        title: t('dialog.detail.title'),
        gradient: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10',
        className: 'border-b border-blue-500/20',
      }}
      contentClassName="flex flex-col overflow-hidden"
      contentPadding="p-0"
    >
      {loading ? (
        <div className="flex items-center justify-center py-10 px-5">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-4 px-5">{error}</div>
      ) : extensionDetail ? (
        <ScrollArea className="flex-1 px-5 py-5">
          <div className="space-y-4 pr-4">
            {/* 基本信息 */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <ExtensionIcon
                  icon={extensionDetail.icon}
                  source={extensionDetail.source}
                  containerClassName="h-16 w-16 rounded-lg border border-border bg-muted"
                  imageClassName="rounded-lg"
                  textClassName="text-2xl"
                  fallbackClassName="h-8 w-8"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground">
                    {extensionDetail.name}
                  </h3>
                  {extensionDetail.author && (
                    <p className="text-xs text-muted-foreground mt-1">{extensionDetail.author}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">
                      v{extensionDetail.version}
                    </span>
                    {extensionDetail.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        <span className="text-xs text-muted-foreground">
                          {extensionDetail.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {extensionDetail.description && (
                <p className="text-sm text-foreground leading-relaxed">
                  {extensionDetail.description}
                </p>
              )}
            </div>

            {/* 详细信息 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dialog.detail.category')}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {formatCategory(extensionDetail.category)}
                </p>
              </div>

              <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dialog.detail.browser')}
                  </span>
                </div>
                <p className="text-sm text-foreground">{t(`browser.${extensionDetail.browser}`)}</p>
              </div>

              <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dialog.detail.downloads')}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {extensionDetail.downloads?.toLocaleString() || '-'}
                </p>
              </div>

              <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dialog.detail.fileSize')}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {formatFileSize(extensionDetail.fileSize)}
                </p>
              </div>
            </div>

            {/* 权限 */}
            {extensionDetail.permissions && extensionDetail.permissions.length > 0 && (
              <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('dialog.detail.permissions')}
                  </span>
                </div>
                <ScrollArea className="h-[120px]">
                  <div className="flex flex-wrap gap-1.5 pr-4">
                    {extensionDetail.permissions.map((permission, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-0.5 bg-background border border-border rounded text-foreground"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* 时间信息 */}
            <div className="grid grid-cols-2 gap-3">
              {extensionDetail.updatedAt && (
                <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('dialog.detail.updatedAt')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{formatDate(extensionDetail.updatedAt)}</p>
                </div>
              )}

              {extensionDetail.createdAt && (
                <div className="bg-muted/50 rounded-md p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('dialog.detail.createdAt')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{formatDate(extensionDetail.createdAt)}</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      ) : null}

      <FormattedDialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          {t('dialog.detail.close')}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
