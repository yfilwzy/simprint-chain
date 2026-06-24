import { Skeleton } from '@/components/ui/skeleton';

export function WalletSkeleton() {
  return (
    <div className="m-4 ml-0">
      <div className="flex h-[calc(100vh-120px)]">
        {/* 左侧内容 - 2/3 宽度 */}
        <div className="flex-1 w-2/3 p-4 py-0 space-y-4 h-full">
          {/* 当前套餐信息 */}
          <div>
            <div className="bg-background border border-border rounded-lg p-4 h-48 relative overflow-hidden">
              <div className="flex flex-col justify-between h-full relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-3 w-3" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-3 w-3" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end items-center gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </div>
          </div>

          {/* 资源使用情况 */}
          <div>
            <Skeleton className="h-5 w-32 mb-2" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-background border border-border rounded-lg p-4 relative"
                >
                  {/* 管理链接 - 右上角 */}
                  <div className="absolute top-3 right-3">
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    {/* 图标和名称 */}
                    <div className="flex items-center gap-2 w-full">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-20" />
                    </div>

                    {/* 圆形进度条 */}
                    <div className="relative w-24 h-24">
                      <Skeleton className="h-24 w-24 rounded-full" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Skeleton className="h-5 w-8" />
                      </div>
                    </div>

                    {/* 使用量信息 */}
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 自动续订服务 */}
          <div>
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="bg-background border border-border rounded-lg p-4">
              {/* 空状态 skeleton */}
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Skeleton className="h-12 w-12 rounded-full mb-3" />
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        </div>

        {/* 右侧内容 - 1/3 宽度 */}
        <div className="w-1/3 bg-background rounded-lg border p-4 space-y-4 mb-4">
          {/* 钱包信息 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            {/* 银行卡样式 skeleton - 完全匹配 WalletCard 结构 */}
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl mb-4 h-56 overflow-hidden">
              {/* Canvas 背景占位 */}
              <div className="absolute inset-0 w-full h-full pointer-events-none bg-gray-50 dark:bg-gray-800/50" />
              {/* 内容层 */}
              <div className="relative z-10 h-full flex flex-col justify-between p-7">
                {/* 顶部区域 */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* 加密圆圈装饰 */}
                    <div className="flex items-center gap-0.5 mb-4">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <Skeleton key={i} className="h-2 w-2 rounded-full" />
                      ))}
                    </div>
                    {/* 余额标签 */}
                    <Skeleton className="h-3 w-16 mb-2" />
                    {/* 余额金额 */}
                    <Skeleton className="h-12 w-32" />
                  </div>
                  {/* 钱包图标 */}
                  <Skeleton className="h-13 w-13 rounded-xl" />
                </div>

                {/* 底部区域 */}
                <div className="flex items-end justify-between pt-5 border-t border-gray-200 dark:border-gray-700">
                  <Skeleton className="h-3 w-20" />
                  {/* 装饰性元素 - 模拟芯片 */}
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-1.5 w-1.5 rounded-sm" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <Skeleton className="h-9 w-full" />
          </div>

          {/* 自动续订组合支付 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <Skeleton className="h-8 w-full" />
          </div>

          {/* 月结费用（条件渲染，可能不显示） */}
          <div>
            <Skeleton className="h-5 w-24 mb-4" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-40 mb-3" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
