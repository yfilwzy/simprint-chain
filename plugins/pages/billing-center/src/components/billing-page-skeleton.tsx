import { Skeleton } from '@/components/ui/skeleton';

export function BillingPageSkeleton() {
  return (
    <main className="flex-1 flex flex-col min-w-0 bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* 头部区域 */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* 统计卡片区域 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="bg-background border border-border rounded-lg p-4 space-y-2"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>

          {/* 表格区域 */}
          <div className="flex-1 flex flex-col bg-background border border-border min-h-0 overflow-hidden">
            <div className="p-4 border-b border-border">
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
