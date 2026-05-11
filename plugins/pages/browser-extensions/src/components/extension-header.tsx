import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExtensionHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'installed' | 'store' | 'local';
  onViewModeChange: (mode: 'installed' | 'store' | 'local') => void;
  installedCount: number;
}

export function ExtensionHeader({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  installedCount,
}: ExtensionHeaderProps) {
  const { t } = useTranslation('extensions');
  const [searchValue, setSearchValue] = useState(searchQuery);
  const searchChangeRef = useRef(onSearchChange);

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchChangeRef.current(searchValue);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchValue]);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-border bg-background/10 backdrop-blur-2xl">
      {/* 左侧：搜索框 */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t('header.searchPlaceholder')}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-8 h-9 text-xs w-56"
        />
      </div>

      {/* 右侧：Tab */}
      <div className="flex items-center gap-3">
        <Tabs
          value={viewMode}
          onValueChange={(v) => onViewModeChange(v as 'installed' | 'store' | 'local')}
        >
          <TabsList className="h-8 bg-secondary">
            <TabsTrigger value="installed" className="text-xs px-4 h-7">
              {t('viewMode.installed')} ({installedCount})
            </TabsTrigger>
            <TabsTrigger value="store" className="text-xs px-4 h-7">
              {t('viewMode.store')}
            </TabsTrigger>
            <TabsTrigger value="local" className="text-xs px-4 h-7">
              {t('viewMode.local')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
