import { useTranslation } from 'react-i18next';
import { useResetForm } from '../hooks/use-reset-form';
import { useResetValidation } from '../hooks/use-reset-validation';
import { useResetCode } from '../hooks/use-reset-code';
import { useResetPassword } from '../hooks/use-reset-password';
import { useResetHandlers } from '../hooks/use-reset-handlers';
import { ResetStep1 } from './reset-step1';
import { ResetStep2 } from './reset-step2';

export const ResetForm: React.FC = () => {
  const { t } = useTranslation('auth');

  // 表单状态管理
  const form = useResetForm();

  // 表单验证
  const validation = useResetValidation();

  // 验证码管理
  const code = useResetCode();

  // 重置密码操作
  const resetPassword = useResetPassword();

  // 事件处理
  const handlers = useResetHandlers({
    form,
    validation,
    code,
    resetPassword,
  });

  return (
    <>
      <div className="text-center mb-10">
        <h1 className="mb-2 tracking-tight">{t('reset.title')}</h1>
        <p className="text-muted-foreground">
          {form.step === 1 ? t('reset.subtitleStep1') : t('reset.subtitleStep2')}
        </p>
      </div>

      <form onSubmit={handlers.handleSubmit} className="space-y-5">
        {form.step === 1 ? (
          <ResetStep1
            email={form.formData.email}
            emailError={validation.errors.email}
            onEmailChange={handlers.handleEmailChange}
            onSubmit={handlers.handleSendCode}
          />
        ) : (
          <ResetStep2
            code={form.formData.code}
            newPassword={form.formData.newPassword}
            confirmPassword={form.formData.confirmPassword}
            countdown={code.countdown}
            codeError={validation.errors.code}
            passwordError={validation.errors.password}
            confirmPasswordError={validation.errors.confirmPassword}
            onCodeChange={handlers.handleCodeChange}
            onNewPasswordChange={handlers.handleNewPasswordChange}
            onConfirmPasswordChange={handlers.handleConfirmPasswordChange}
            onResendCode={handlers.handleSendCode}
          />
        )}
      </form>
    </>
  );
};
