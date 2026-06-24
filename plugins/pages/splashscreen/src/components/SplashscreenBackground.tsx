import { useGridAnimation } from '../hooks/useGridAnimation';

/**
 * Splashscreen 背景组件
 * 包含高密度网格动画和背景光效
 */
export const SplashscreenBackground: React.FC = () => {
  const canvasRef = useGridAnimation({
    cellSize: 30,
    lineWidth: 0.5,
    color: 'rgba(37, 99, 235, 0.06)', // 使用与登录界面相同的蓝色 (blue-600)
    rotation: 90,
    speed: 0.3,
  });

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* 背景光效 - 使用与登录界面相同的蓝色 (blue-600: rgba(37, 99, 235)) */}
      <div
        className="absolute top-0 left-0 w-96 h-96 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2"
        style={{ backgroundColor: 'rgba(37, 99, 235, 0.15)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2"
        style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)' }}
      />
    </>
  );
};
