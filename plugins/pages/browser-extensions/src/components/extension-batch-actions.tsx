import { useTranslation } from 'react-i18next';

interface ExtensionBatchActionsProps {
  selectedCount: number;
  onBatchInstall: () => void;
  onBatchUpdate: () => void;
  onBatchUninstall: () => void;
  onClearSelection: () => void;
}

export function ExtensionBatchActions({
  selectedCount,
  onBatchInstall,
  onBatchUpdate,
  onBatchUninstall,
  onClearSelection,
}: ExtensionBatchActionsProps) {
  const { t } = useTranslation('extensions');

  if (selectedCount === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground px-3 py-2 flex items-center gap-3 shadow-2xl border border-border z-[100] rounded-sm">
      <div className="flex items-center gap-2 pr-3 border-r border-border whitespace-nowrap">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">
          {t('batch.selected')}:
        </span>
        <span className="font-mono text-primary font-bold">
          {selectedCount.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="flex gap-1 flex-nowrap">
        <button
          onClick={onBatchInstall}
          className="text-xs font-bold hover:text-primary hover:bg-accent flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-sm"
        >
          <i className="fa-solid fa-download text-[10px]"></i> {t('batch.install')}
        </button>
        <button
          onClick={onBatchUpdate}
          className="text-xs font-bold hover:text-primary hover:bg-accent flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-sm"
        >
          <i className="fa-solid fa-arrows-rotate text-[10px]"></i> {t('batch.update')}
        </button>
        <button
          onClick={onBatchUninstall}
          className="text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-sm"
        >
          <i className="fa-solid fa-trash-can text-[10px]"></i> {t('batch.uninstall')}
        </button>
      </div>
      <button
        onClick={onClearSelection}
        className="ml-3 h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer rounded-sm"
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}
