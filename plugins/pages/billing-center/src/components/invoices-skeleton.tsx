import { Skeleton } from '@/components/ui/skeleton';
import { BillingTableSkeleton } from './billing-table-skeleton';

export function InvoicesSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 顶部搜索栏 */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background z-10">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
        </div>
      </header>

      {/* 统计信息 */}
      <section className="h-10 bg-background border-b border-border flex items-center px-6 gap-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </section>

      {/* 账单表格 */}
      <div className="flex-1 flex flex-col bg-background m-4 border border-border min-h-0 overflow-hidden">
        <div className="flex-1 h-0 w-full">
          <div className="min-w-full">
            <table
              className="w-full border-collapse table-auto"
              style={{ minWidth: 'max-content' }}
            >
              <thead>
                <tr>
                  {Array.from({ length: 7 }).map((_, index) => (
                    <th
                      key={index}
                      className="sticky top-0 bg-background z-5 text-left px-4 py-3 border-b-2 border-border"
                    >
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <BillingTableSkeleton rows={8} />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border">
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
