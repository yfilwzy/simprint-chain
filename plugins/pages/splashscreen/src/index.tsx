import '../../../../src/index.css';
import './styles/animations.css';
import { useSplashscreenInit } from './hooks/useSplashscreenInit';
import { useSplashscreenEvents } from './hooks/useSplashscreenEvents';
import { useSplashscreenWindowDisplay } from './hooks/use-splashscreen-window-display';
import { useSplashscreenClose } from './hooks/use-splashscreen-close';
import {
  SplashscreenBackground,
  SplashscreenLogo,
  SplashscreenContent,
  SplashscreenLoadingText,
  SplashscreenErrorMessage,
  SplashscreenDecoration,
} from './components';
import { SplashscreenCloseButton } from './components/splashscreen-close-button';

/**
 * Splashscreen 页面主组件
 * 负责整合所有子组件和业务逻辑
 */
const SplashscreenPage: React.FC = () => {
  // 初始化应用状态检查
  useSplashscreenInit();

  // 监听事件并获取状态
  const { loadingText, errorMessage, connectionFailed, showCloseButton, progress, isUpdating } =
    useSplashscreenEvents();

  // 窗口显示控制
  const { contentRef } = useSplashscreenWindowDisplay();

  // 关闭窗口处理
  const { handleClose } = useSplashscreenClose();

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50/80 via-blue-100/60 to-blue-50/80 flex items-center justify-center overflow-hidden">
      {/* 背景（网格动画和光效） */}
      <SplashscreenBackground />

      {/* 右上角关闭按钮（仅在连接失败时显示） */}
      {showCloseButton && <SplashscreenCloseButton onClose={handleClose} />}

      {/* 主要内容区域 */}
      <div ref={contentRef} className="relative z-10 flex flex-col items-center gap-12">
        {/* Logo 区域 */}
        <SplashscreenLogo />

        {/* 内容区域（标题） */}
        <SplashscreenContent />

        {/* 错误消息（仅在非连接失败错误时显示） */}
        {errorMessage && !connectionFailed && <SplashscreenErrorMessage message={errorMessage} />}
      </div>

      {/* 右下角加载文本 */}
      <SplashscreenLoadingText
        loadingText={loadingText}
        progress={progress}
        isUpdating={isUpdating}
      />

      {/* 装饰元素 */}
      <SplashscreenDecoration />
    </div>
  );
};

const splashscreenPlugin = {
  id: 'splashscreen',
  name: 'Splashscreen',
  version: '1.0.0',
  component: SplashscreenPage,
  slots: [],
};

export default splashscreenPlugin;
