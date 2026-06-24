import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useLoading } from '../../../../services/store/src';
import type { ResetFormData } from '../types';
import { resetPassword } from '../api';

export interface UseResetPasswordReturn {
  handleResetPassword: (formData: ResetFormData) => Promise<void>;
}

/**
 * 重置密码操作 Hook
 */
export function useResetPassword(): UseResetPasswordReturn {
  const navigate = useNavigate();
  const { setLoading } = useLoading();

  const handleResetPassword = useCallback(
    async (formData: ResetFormData) => {
      setLoading(true);

      try {
        await resetPassword(formData.email, formData.code, formData.newPassword);

        // 重置成功，显示成功提示并跳转到登录页
        toast.success('密码重置成功', {
          description: '请使用新密码登录',
        });

        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          navigate('/auth/login');
        }, 1000);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '重置密码失败';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [navigate, setLoading]
  );

  return {
    handleResetPassword,
  };
}
