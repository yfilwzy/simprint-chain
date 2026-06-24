import { useState, useCallback } from 'react';
import type { RegisterFormData } from '../types';

interface UseRegisterFormReturn {
  formData: RegisterFormData;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setConfirmPassword: (confirmPassword: string) => void;
  setCode: (code: string) => void;
  resetForm: () => void;
}

/**
 * 注册表单状态管理 Hook
 */
export function useRegisterForm(): UseRegisterFormReturn {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
  });

  const setEmail = useCallback((email: string) => {
    setFormData((prev) => ({ ...prev, email }));
  }, []);

  const setPassword = useCallback((password: string) => {
    setFormData((prev) => ({ ...prev, password }));
  }, []);

  const setConfirmPassword = useCallback((confirmPassword: string) => {
    setFormData((prev) => ({ ...prev, confirmPassword }));
  }, []);

  const setCode = useCallback((code: string) => {
    setFormData((prev) => ({ ...prev, code }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      code: '',
    });
  }, []);

  return {
    formData,
    setEmail,
    setPassword,
    setConfirmPassword,
    setCode,
    resetForm,
  };
}
