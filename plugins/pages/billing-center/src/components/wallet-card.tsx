import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Circle } from 'lucide-react';

interface WalletCardProps {
  balance: number;
  giftBalance: number;
}

/**
 * 钱包卡片组件 - 带 Canvas 装饰
 */
export function WalletCard({ balance, giftBalance }: WalletCardProps) {
  const { t } = useTranslation('billing');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawPattern = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      ctx.clearRect(0, 0, width, height);

      // 绘制网格背景
      const gridSize = 16;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.lineWidth = 0.5;

      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }

      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
      }

      // 绘制装饰性渐变圆圈
      const circles = [
        { x: width * 0.2, y: height * 0.15, radius: 50, opacity: 0.08 },
        { x: width * 0.8, y: height * 0.25, radius: 60, opacity: 0.06 },
        { x: width * 0.75, y: height * 0.75, radius: 40, opacity: 0.07 },
      ];

      circles.forEach((circle) => {
        const gradient = ctx.createRadialGradient(
          circle.x,
          circle.y,
          0,
          circle.x,
          circle.y,
          circle.radius
        );
        gradient.addColorStop(0, `rgba(0, 0, 0, ${circle.opacity})`);
        gradient.addColorStop(0.5, `rgba(0, 0, 0, ${circle.opacity * 0.5})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // 绘制点阵装饰
      ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
      const dotSpacing = 24;
      for (let x = dotSpacing; x < width; x += dotSpacing) {
        for (let y = dotSpacing; y < height; y += dotSpacing) {
          if (Math.random() > 0.85) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    // 初始绘制
    drawPattern();

    // 监听窗口大小变化
    const resizeObserver = new ResizeObserver(() => {
      drawPattern();
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl mb-4 h-56 overflow-hidden">
      {/* Canvas 背景 */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      {/* 内容层 - 重新设计的银行卡样式 */}
      <div className="relative z-10 h-full flex flex-col justify-between p-7">
        {/* 顶部区域 */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* 加密圆圈装饰 */}
            <div className="flex items-center gap-0.5 mb-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <Circle key={i} className="w-2 h-2 fill-gray-400 dark:fill-gray-600" />
              ))}
            </div>
            {/* 余额标签 */}
            <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-2 font-medium">
              {t('wallet.balance')}
            </div>
            {/* 余额金额 */}
            <div className="text-5xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              ${balance.toFixed(2)}
            </div>
          </div>
          {/* 钱包图标 */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
            <Wallet className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* 中间区域 - 如果有赠送金 */}
        {giftBalance > 0 && (
          <div className="py-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold">{t('wallet.gift')}:</span>{' '}
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                ${giftBalance.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* 底部区域 */}
        <div className="flex items-end justify-between pt-5 border-t border-gray-200 dark:border-gray-700">
          <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-medium">
            {t('wallet.title')}
          </div>
          {/* 装饰性元素 - 模拟芯片 */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-sm bg-gray-300 dark:bg-gray-600" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
