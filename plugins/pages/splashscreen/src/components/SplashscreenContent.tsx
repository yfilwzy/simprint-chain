/**
 * Splashscreen 内容组件
 * 包含标题
 */
export const SplashscreenContent: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-3">
      <h1
        className="text-5xl font-bold text-slate-800 tracking-tight"
        style={{ animation: 'fade-in-up 0.6s ease-out' }}
      >
        <span
          className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent"
          style={{ color: 'rgba(37, 99, 235, 1)' }}
        >
          {/* Simprint */}
        </span>
      </h1>
    </div>
  );
};
