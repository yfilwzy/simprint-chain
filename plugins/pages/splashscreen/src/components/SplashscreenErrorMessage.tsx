interface SplashscreenErrorMessageProps {
  message: string;
}

/**
 * Splashscreen 错误消息组件
 */
export const SplashscreenErrorMessage: React.FC<SplashscreenErrorMessageProps> = ({ message }) => {
  return (
    <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-3 text-sm text-red-100">
      {message}
    </div>
  );
};
