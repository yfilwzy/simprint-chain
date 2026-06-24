import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { Upload, Download, Search } from 'lucide-react';

interface ProxyHeaderProps {
  onSearchChange?: (value: string) => void;
  onCreateNew?: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

export function ProxyHeader({
  onSearchChange,
  onCreateNew,
  onImport,
  onExport,
}: ProxyHeaderProps) {
  const { t } = useTranslation('proxy');
  const [searchValue, setSearchValue] = useState('');
  const searchChangeRef = useRef(onSearchChange);

  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchChangeRef.current?.(searchValue);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchValue]);

  return (
    <header className="border-b border-border flex items-center justify-between px-6 py-2 bg-background/10 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('header.searchPlaceholder')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="h-9 w-72 pl-8 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onImport}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border border-border rounded hover:bg-accent transition-colors"
          title={t('header.import')}
        >
          <Upload className="h-3.5 w-3.5" />
          {t('header.import')}
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 border border-border rounded hover:bg-accent transition-colors"
          title={t('header.export')}
        >
          <Download className="h-3.5 w-3.5" />
          {t('header.export')}
        </button>
        <button
          onClick={onCreateNew}
          className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 hover:bg-primary/90 transition-colors border border-primary rounded-md"
        >
          {t('header.create')}
        </button>
      </div>
    </header>
  );
}
