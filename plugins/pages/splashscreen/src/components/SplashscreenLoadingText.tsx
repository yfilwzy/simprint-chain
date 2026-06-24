interface SplashscreenLoadingTextProps {
  loadingText: string;
  progress?: number;
  isUpdating?: boolean;
}

/**
 * Splashscreen 加载文本组件
 * 显示在右下角
 */
export const SplashscreenLoadingText: React.FC<SplashscreenLoadingTextProps> = ({
  loadingText,
  progress,
  isUpdating,
}) => {
  const displayProgress =
    typeof progress === 'number' && !Number.isNaN(progress)
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : null;

  return (
    <div
      className="absolute bottom-8 right-8 z-10 flex items-center gap-3 text-sm uppercase tracking-[0.3em] font-medium opacity-85"
      style={{ color: 'rgba(37, 99, 235, 0.8)', animation: 'fade-in 0.6s ease-out 0.4s both' }}
    >
      {isUpdating && (
        <>
          <span
            className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
            aria-hidden
          />
          {displayProgress !== null && (
            <span className="text-xs font-semibold tracking-normal">{displayProgress}%</span>
          )}
        </>
      )}
      <span className="tracking-[0.25em] font-alimama">{loadingText}</span>
    </div>
  );
};
