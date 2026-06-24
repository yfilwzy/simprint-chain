import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Clock, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RedeemableRewardCardProps {
  availablePoints: number;
  pendingPoints: number;
  onRedeem: () => void;
}

export const RedeemableRewardCard: React.FC<RedeemableRewardCardProps> = ({
  availablePoints,
  pendingPoints,
  onRedeem,
}) => {
  const { t } = useTranslation('referral');
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
    <div className="relative bg-background border border-border row-span-2 overflow-hidden">
      {/* Canvas 背景 */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* 图标背景 */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <Gift className="absolute top-8 right-8 h-32 w-32" />
        <Sparkles className="absolute top-16 left-8 h-24 w-24" />
        <TrendingUp className="absolute bottom-12 right-12 h-20 w-20" />
      </div>

      {/* 内容层 */}
      <div className="relative z-10 h-full flex flex-col justify-between p-4">
        <div className="flex-1">
          {/* 顶部区域 */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              {/* 标题 */}
              <div className="text-xs font-medium text-foreground mb-1">
                {t('overview.withdrawableBalance')}
              </div>
              {/* 奖励点数 */}
              <div className="text-3xl font-bold text-foreground mb-2">{availablePoints}</div>
            </div>
            {/* 图标 */}
            <div className="p-3 bg-primary/10 rounded-lg">
              <Gift className="h-6 w-6 text-primary" />
            </div>
          </div>

          {/* 待审核奖励提示 */}
          {pendingPoints > 0 && (
            <div className="bg-warning/10 border border-warning/20 rounded p-2.5 mb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-warning" />
                <span className="text-xs font-medium text-warning">
                  {t('overview.pendingRewards')}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {pendingPoints} {t('overview.stats.underReview')}
              </div>
            </div>
          )}

          {/* 激励描述文本 */}
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {t('overview.withdrawableBalanceMotivation')}
          </p>
        </div>

        {/* 底部按钮 */}
        <Button
          size="sm"
          className="w-full text-xs h-7 mt-auto"
          onClick={onRedeem}
          disabled={availablePoints === 0}
        >
          {t('overview.applyRedeem')}
        </Button>
      </div>
    </div>
  );
};
