import { useEffect, useRef } from 'react';

interface GridConfig {
  cellSize?: number;
  lineWidth?: number;
  color?: string;
  rotation?: number;
  speed?: number;
}

/**
 * 高密度网格动画 Hook
 * 负责管理 Canvas 网格动画效果
 */
export function useGridAnimation(config: GridConfig = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      cellSize = 30,
      lineWidth = 0.5,
      color = 'rgba(37, 99, 235, 0.06)', // 使用与登录界面相同的蓝色 (blue-600)
      rotation = 90,
      speed = 0.3,
    } = config;

    // 设置画布尺寸
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let offset = 0;
    let animationId: number;

    function drawGrid() {
      if (!ctx || !canvas) return;

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 保存当前状态
      ctx.save();

      // 移动到画布中心
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // 旋转网格（90度效果）
      ctx.rotate((rotation * Math.PI) / 180);

      // 设置样式
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      // 计算需要绘制的网格范围（覆盖整个屏幕）
      const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
      const halfSize = diagonal / 2;

      // 绘制垂直线（旋转后会变成水平）
      const verticalOffset = offset % cellSize;
      for (let x = -halfSize; x <= halfSize; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x + verticalOffset, -halfSize);
        ctx.lineTo(x + verticalOffset, halfSize);
        ctx.stroke();
      }

      // 绘制水平线（旋转后会变成垂直）
      const horizontalOffset = offset % cellSize;
      for (let y = -halfSize; y <= halfSize; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(-halfSize, y + horizontalOffset);
        ctx.lineTo(halfSize, y + horizontalOffset);
        ctx.stroke();
      }

      // 恢复状态
      ctx.restore();

      // 更新偏移量
      offset += speed;
    }

    function animate() {
      drawGrid();
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [config]);

  return canvasRef;
}
