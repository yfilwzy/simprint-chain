import { extensionRegistry } from '@slotkitjs/core';
import { ResetForm } from './components/reset-form';

// 页面组件
const ResetPasswordPage: React.FC = () => {
  return <ResetForm />;
};

// 在模块加载时贡献路由
try {
  extensionRegistry.contribute('routes', {
    contributorId: 'reset-password',
    value: {
      path: '/auth/reset-password',
      Component: ResetPasswordPage,
    },
    priority: 10,
  });
  console.log('[reset-password] Route contributed at module load: /auth/reset-password');
} catch (error) {
  console.warn(
    '[reset-password] Failed to contribute route at module load (extension point may not be registered yet):',
    error
  );
}

const resetPasswordPlugin = {
  id: 'reset-password',
  name: 'Reset Password',
  version: '1.0.0',
  component: ResetPasswordPage,
  slots: [],
};

export default resetPasswordPlugin;
