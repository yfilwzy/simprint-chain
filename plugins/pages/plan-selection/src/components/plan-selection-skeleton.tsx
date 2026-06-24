import { Skeleton } from '@/components/ui/skeleton';
import { PlanCardSkeleton } from './plan-card-skeleton';

export function PlanSelectionSkeleton() {
  return (
    <main className="flex-1 flex flex-col min-w-0">
      <div className="flex-1 overflow-y-auto">
        <div className="w-4/5 mx-auto my-4 space-y-4">
          {/* 顶部状态横幅 */}
          <Skeleton className="h-12 w-full rounded-lg" />

          <div className="flex h-[calc(100vh-200px)]">
            {/* 左侧内容 - 2/3 宽度 */}
            <div className="flex-1 w-2/3 p-6 space-y-6 overflow-y-auto">
              {/* 套餐选择卡片 */}
              <div>
                <Skeleton className="h-5 w-24 mb-4" />
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <PlanCardSkeleton key={index} />
                  ))}
                </div>
              </div>

              {/* 环境配额显示 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-3 w-full" />
              </div>

              {/* 分割线 */}
              <Skeleton className="h-px w-full" />

              {/* 详细功能列表 */}
              <div>
                <Skeleton className="h-5 w-24 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 右侧内容 - 1/3 宽度 */}
            <div className="w-1/3 bg-background rounded-lg border p-6 space-y-6 overflow-y-auto">
              {/* 套餐详情部分 */}
              <div>
                <Skeleton className="h-5 w-24 mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 分割线 */}
              <Skeleton className="h-px w-full" />

              {/* 价格信息部分 */}
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>

              {/* 支付按钮 */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-start gap-2 mb-4">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-8 flex-1" />
                </div>
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
