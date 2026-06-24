import { Skeleton } from '@/components/ui/skeleton';

interface ExtensionTableSkeletonProps {
  rows?: number;
}

export function ExtensionTableSkeleton({ rows = 8 }: ExtensionTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="group hover:bg-secondary/50 transition-colors">
          {/* 复选框列 */}
          <td className="sticky left-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-2.5 border-b border-border text-center transition-colors">
            <div className="flex items-center justify-center">
              <Skeleton className="h-4 w-4" />
            </div>
          </td>
          {/* 名称列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <div className="font-bold flex items-center gap-2 mb-1">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-48" />
          </td>
          {/* 版本列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-12" />
          </td>
          {/* 状态列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 浏览器列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 作者列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 下载量列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-16" />
          </td>
          {/* 更新时间列 */}
          <td className="px-4 py-2.5 border-b border-border text-xs text-muted-foreground font-mono">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 操作列 */}
          <td className="sticky right-0 bg-background group-hover:bg-secondary/50 z-5 px-4 py-2.5 border-b border-border transition-colors">
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-7 w-7" />
              <Skeleton className="h-7 w-7" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
