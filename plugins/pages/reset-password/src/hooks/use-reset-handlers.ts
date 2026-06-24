import { useCallback } from 'react';
import type { UseResetFormReturn } from './use-reset-form';
import type { UseResetValidationReturn } from './use-reset-validation';
import type { UseResetCodeReturn } from './use-reset-code';
import type { UseResetPasswordReturn } from './use-reset-password';

interface UseResetHandlersParams {
  form: UseResetFormReturn;
  validation: UseResetValidationReturn;
  code: UseResetCodeReturn;
  resetPassword: UseResetPasswordReturn;
}

interface UseResetHandlersReturn {
  handleSendCode: () => Promise<void>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleEmailChange: (value: string) => void;
  handleCodeChange: (value: string) => void;
  handleNewPasswordChange: (value: string) => void;
  handleConfirmPasswordChange: (value: string) => void;
}

/**
 * 重置密码事件处理 Hook
 * 整合所有事件处理逻辑
 */
export function useResetHandlers(params: UseResetHandlersParams): UseResetHandlersReturn {
  const { form, validation, code, resetPassword } = params;

  // 处理发送验证码
  const handleSendCode = useCallback(async () => {
    validation.clearErrors();

    // 验证邮箱
    if (!validation.validateStep1(form.formData.email)) {
      return;
    }

    try {
      await code.sendCode(form.formData.email);
      form.setStep(2); // 进入第二步
    } catch (error: any) {
      validation.setEmailError(error?.message || error?.toString() || '发送验证码失败');
    }
  }, [form, validation, code]);

  // 处理表单提交
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (form.step === 1) {
        // 第一步：发送验证码
        await handleSendCode();
        return;
      }

      // 第二步：重置密码
      validation.clearErrors();

      // 验证表单
      if (
        !validation.validateStep2({
          code: form.formData.code,
          newPassword: form.formData.newPassword,
          confirmPassword: form.formData.confirmPassword,
        })
      ) {
        return;
      }

      // 执行重置密码
      try {
        await resetPassword.handleResetPassword(form.formData);
      } catch (error: any) {
        console.error('重置密码失败:', error);
        const errorMessage = error?.message || error?.toString() || '重置密码失败，请重试';
        validation.setCodeError(errorMessage);
      }
    },
    [form, validation, resetPassword, handleSendCode]
  );

  // 处理邮箱变化
  const handleEmailChange = useCallback(
    (value: string) => {
      form.setEmail(value);
      validation.clearErrors();
    },
    [form, validation]
  );

  // 处理验证码变化
  const handleCodeChange = useCallback(
    (value: string) => {
      form.setCode(value);
      validation.clearErrors();
    },
    [form, validation]
  );

  // 处理新密码变化
  const handleNewPasswordChange = useCallback(
    (value: string) => {
      form.setNewPassword(value);
      validation.clearErrors();
    },
    [form, validation]
  );

  // 处理确认密码变化
  const handleConfirmPasswordChange = useCallback(
    (value: string) => {
      form.setConfirmPassword(value);
      validation.clearErrors();
    },
    [form, validation]
  );

  return {
    handleSendCode,
    handleSubmit,
    handleEmailChange,
    handleCodeChange,
    handleNewPasswordChange,
    handleConfirmPasswordChange,
  };
}
