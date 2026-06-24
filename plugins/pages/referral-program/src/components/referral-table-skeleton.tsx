import { Skeleton } from '@/components/ui/skeleton';

interface ReferralTableSkeletonProps {
  rows?: number;
}

export function ReferralTableSkeleton({ rows = 8 }: ReferralTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="group hover:bg-secondary/50 transition-colors">
          {/* 序号列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-8" />
          </td>
          {/* 邮箱列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-40" />
          </td>
          {/* 注册时间列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-24" />
          </td>
          {/* 状态列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-5 w-16" />
          </td>
          {/* 奖励列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-20" />
          </td>
          {/* 链接列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-4 w-32" />
          </td>
          {/* 操作列 */}
          <td className="px-4 py-2.5 border-b border-border text-[13px]">
            <Skeleton className="h-7 w-16" />
          </td>
        </tr>
      ))}
    </>
  );
}
