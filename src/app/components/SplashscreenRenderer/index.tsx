import { PluginRenderer } from '../PluginRenderer';

export const SplashscreenRenderer: React.FC = () => {
  return (
    <PluginRenderer
      pluginId="splashscreen"
      fallback={
        <div className="flex items-center justify-center h-screen font-sans text-[rgba(37,99,235,1)] bg-[rgba(239,246,255,0.8)]" />
      }
    />
  );
};
