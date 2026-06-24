import { useTranslation } from 'react-i18next';
import { Puzzle } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/data-table';
import { ExtensionTableRow } from './extension-table-row';
import type { ExtensionItem } from '../types';

export type { ExtensionItem };

/**
 * 空状态组件
 */
const EmptyState: React.FC<{
  t: (key: string) => string;
}> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
      <Puzzle className="h-8 w-8 text-purple-500/60" />
    </div>
    <h4 className="text-sm font-medium text-foreground mb-1">{t('table.empty')}</h4>
    <p className="text-xs text-muted-foreground text-center max-w-[240px]">
      {t('table.emptyDescription')}
    </p>
  </div>
);

interface ExtensionTableProps {
  extensions: ExtensionItem[];
  selectedIds?: Set<string>;
  onSelect?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onUpdate?: (id: string) => void;
  onUninstall?: (id: string, name: string) => void;
  onViewDetails?: (id: string) => void;
  onHomepage?: (id: string) => void;
  onSecurityCheck?: (id: string) => void;
  onDisable?: (id: string, name: string) => void;
  onEnable?: (id: string, name: string) => void;
  loading?: boolean;
}

export function ExtensionTable({
  extensions,
  selectedIds = new Set(),
  onSelect,
  onSelectAll,
  onUpdate,
  onUninstall,
  onViewDetails,
  onHomepage,
  onSecurityCheck,
  onDisable,
  onEnable,
  loading = false,
}: ExtensionTableProps) {
  const { t } = useTranslation('extensions');

  // 定义列
  const columns: ColumnDef<ExtensionItem>[] = [
    {
      id: 'name',
      header: t('table.headers.name'),
      cell: () => null,
      width: 256,
    },
    {
      id: 'status',
      header: t('table.headers.status'),
      cell: () => null,
      width: 112,
    },
    {
      id: 'browser',
      header: t('table.headers.browser'),
      cell: () => null,
      width: 96,
    },
    {
      id: 'groups',
      header: t('table.headers.groups'),
      cell: () => null,
      width: 128,
    },
    {
      id: 'downloads',
      header: t('table.headers.downloads'),
      cell: () => null,
      width: 96,
    },
    {
      id: 'updatedAt',
      header: t('table.headers.updatedAt'),
      cell: () => null,
      width: 112,
    },
    {
      id: 'actions',
      header: t('table.headers.actions'),
      cell: () => null,
      width: 128,
    },
  ];

  // 处理选择变化
  const handleSelectionChange = (newSelectedIds: Set<string>) => {
    const allSelected = extensions.length > 0 && extensions.every((e) => newSelectedIds.has(e.id));
    const noneSelected = extensions.every((e) => !newSelectedIds.has(e.id));

    if (allSelected && onSelectAll) {
      onSelectAll(true);
    } else if (noneSelected && onSelectAll) {
      onSelectAll(false);
    } else if (onSelect) {
      extensions.forEach((extension) => {
        const wasSelected = selectedIds.has(extension.id);
        const isNowSelected = newSelectedIds.has(extension.id);
        if (wasSelected !== isNowSelected) {
          onSelect(extension.id, isNowSelected);
        }
      });
    }
  };

  return (
    <DataTable
      data={extensions}
      columns={columns}
      getRowKey={(extension) => extension.id}
      loading={loading}
      skeletonRows={8}
      emptyText={<EmptyState t={t} />}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
      renderRow={({ row, rowKey, isSelected, onSelect: handleSelect }) => (
        <ExtensionTableRow
          key={rowKey}
          extension={row}
          isSelected={isSelected}
          onSelect={(_id, selected) => handleSelect(selected)}
          onUpdate={onUpdate}
          onUninstall={onUninstall}
          onViewDetails={onViewDetails}
          onHomepage={onHomepage}
          onSecurityCheck={onSecurityCheck}
          onDisable={onDisable}
          onEnable={onEnable}
        />
      )}
    />
  );
}
