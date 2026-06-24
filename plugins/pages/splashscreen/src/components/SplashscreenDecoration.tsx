/**
 * Splashscreen 装饰组件
 * 包含底部装饰线等装饰元素
 */
export const SplashscreenDecoration: React.FC = () => {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent to-transparent"
      style={{
        background: 'linear-gradient(to right, transparent, rgba(37, 99, 235, 0.3), transparent)',
      }}
    />
  );
};
