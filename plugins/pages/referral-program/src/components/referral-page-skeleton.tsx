import { Skeleton } from '@/components/ui/skeleton';

export function ReferralPageSkeleton() {
  return (
    <div className="flex-1 ">
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 顶部：可兑换奖励 + 统计卡片 + 奖励规则 */}
          <div className="grid grid-cols-3 gap-4">
            {/* 可兑换奖励卡片 - 占据两行 */}
            <div className="row-span-2 bg-background border border-border rounded-lg p-4 relative overflow-hidden">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-12 w-24 mb-4" />
              <Skeleton className="h-4 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* 统计卡片 - 链接点击 */}
            <div className="bg-background border border-border p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>

            {/* 充值用户和名下用户（两个独立卡片） */}
            <div className="bg-background p-0">
              <div className="flex gap-3">
                <div className="flex-1 bg-background border border-border p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <div className="flex-1 bg-background border border-border p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-12" />
                </div>
              </div>
            </div>

            {/* 总获得奖励 */}
            <div className="bg-background border border-border p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>

          {/* 中间：推广链接和图表 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 左侧：推广链接选择 */}
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="bg-background border border-border rounded-lg p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-6 w-full mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：图表 */}
            <div className="bg-background border border-border rounded-lg p-4">
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>

          {/* 底部：推广横幅 */}
          <div className="bg-background border border-border rounded-lg p-4">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
