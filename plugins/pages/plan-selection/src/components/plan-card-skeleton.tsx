import { Skeleton } from '@/components/ui/skeleton';

export function PlanCardSkeleton() {
  return (
    <div className="relative border-2 rounded-lg p-4 border-border">
      {/* 徽章位置 */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="text-center space-y-2">
        {/* 套餐名称 */}
        <Skeleton className="h-4 w-20 mx-auto" />
        {/* 价格 */}
        <div className="flex items-baseline justify-center gap-1">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-8" />
        </div>
        {/* 描述 */}
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4 mx-auto" />
      </div>
    </div>
  );
}
