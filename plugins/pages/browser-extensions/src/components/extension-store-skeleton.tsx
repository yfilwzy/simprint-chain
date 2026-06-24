import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ExtensionStoreSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 分类筛选 */}
      <div className="px-4 py-3 border-b border-border bg-background flex items-center gap-4">
        <div className="flex items-center gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-7 w-20" />
          ))}
        </div>
        <div className="ml-auto">
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* 插件卡片列表 */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="bg-background border border-border rounded-lg p-4 space-y-3"
              >
                {/* 图标和名称 */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>

                {/* 描述 */}
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />

                {/* 浏览器和评分 */}
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16" />
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </div>

                {/* 下载量和作者 */}
                <div className="flex items-center justify-between text-xs">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>

                {/* 按钮 */}
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* 分页 */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-8" />
          <Skeleton className="h-9 w-8" />
          <Skeleton className="h-9 w-8" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  );
}
