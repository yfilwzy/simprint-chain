import { X } from 'lucide-react';

interface SplashscreenCloseButtonProps {
  onClose: () => void;
}

/**
 * Splashscreen 关闭按钮组件
 */
export const SplashscreenCloseButton: React.FC<SplashscreenCloseButtonProps> = ({ onClose }) => {
  return (
    <button
      onClick={onClose}
      className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-800 hover:cursor-pointer rounded-md transition-all duration-200"
      aria-label="关闭"
    >
      <X className="w-5 h-5" />
    </button>
  );
};
