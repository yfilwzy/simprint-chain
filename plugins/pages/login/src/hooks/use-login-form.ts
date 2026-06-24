import { useState, useCallback } from 'react';
import type { LoginFormData } from '../types';

interface UseLoginFormReturn {
  formData: LoginFormData;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setRememberPassword: (remember: boolean) => void;
  resetForm: () => void;
}

/**
 * 登录表单状态管理 Hook
 */
export function useLoginForm(): UseLoginFormReturn {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberPassword: false,
  });

  const setEmail = useCallback((email: string) => {
    setFormData((prev) => ({ ...prev, email }));
  }, []);

  const setPassword = useCallback((password: string) => {
    setFormData((prev) => ({ ...prev, password }));
  }, []);

  const setRememberPassword = useCallback((remember: boolean) => {
    setFormData((prev) => ({ ...prev, rememberPassword: remember }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      email: '',
      password: '',
      rememberPassword: false,
    });
  }, []);

  return {
    formData,
    setEmail,
    setPassword,
    setRememberPassword,
    resetForm,
  };
}
