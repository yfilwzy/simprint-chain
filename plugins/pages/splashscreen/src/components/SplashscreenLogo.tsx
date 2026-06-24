/**
 * Splashscreen Logo 组件
 * 包含光晕、旋转光环、Logo 图片和悬浮粒子
 */
export const SplashscreenLogo: React.FC = () => {
  return (
    <div className="relative">
      {/* 外层光晕 - 多层叠加 - 使用与登录界面相同的蓝色 */}
      <div className="absolute inset-0 -m-16">
        <div
          className="absolute inset-0 rounded-full blur-[100px] opacity-40 animate-pulse"
          style={{ backgroundColor: 'rgba(37, 99, 235, 0.2)' }}
        />
        <div
          className="absolute inset-0 rounded-full blur-[80px] opacity-30 animate-pulse"
          style={{ animationDelay: '0.5s', backgroundColor: 'rgba(37, 99, 235, 0.15)' }}
        />
      </div>

      {/* 旋转光环 */}
      <div className="absolute -inset-8" style={{ animation: 'spin 8s linear infinite' }}>
        <div
          className="w-full h-full rounded-full border-4 border-transparent opacity-50"
          style={{
            borderTopColor: 'rgba(37, 99, 235, 0.5)',
            borderRightColor: 'rgba(37, 99, 235, 0.4)',
          }}
        />
      </div>

      {/* LOGO主体 */}
      <div
        className="relative w-32 h-32 bg-gradient-to-br from-blue-50/95 via-blue-100/95 to-blue-50/95 rounded-3xl flex items-center justify-center shadow-2xl p-4 backdrop-blur-sm border"
        style={{
          boxShadow: '0 25px 50px -12px rgba(37, 99, 235, 0.15)',
          borderColor: 'rgba(37, 99, 235, 0.2)',
        }}
      >
        <img src="/assets/logo.png" alt="Simprint Logo" className="w-full h-full object-contain" />
      </div>

      {/* 悬浮粒子环绕 - 使用与登录界面相同的蓝色 */}
      <div className="absolute -inset-12 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 w-2 h-2 rounded-full"
          style={{
            animation: 'float-1 3s ease-in-out infinite',
            backgroundColor: 'rgba(37, 99, 235, 0.4)',
          }}
        />
        <div
          className="absolute top-1/4 right-0 w-1.5 h-1.5 rounded-full"
          style={{
            animation: 'float-2 3s ease-in-out infinite 0.75s',
            backgroundColor: 'rgba(37, 99, 235, 0.35)',
          }}
        />
        <div
          className="absolute bottom-1/4 left-0 w-1.5 h-1.5 rounded-full"
          style={{
            animation: 'float-3 3s ease-in-out infinite 1.5s',
            backgroundColor: 'rgba(37, 99, 235, 0.4)',
          }}
        />
        <div
          className="absolute bottom-0 right-1/3 w-2 h-2 rounded-full"
          style={{
            animation: 'float-4 3s ease-in-out infinite 2.25s',
            backgroundColor: 'rgba(37, 99, 235, 0.35)',
          }}
        />
      </div>
    </div>
  );
};
