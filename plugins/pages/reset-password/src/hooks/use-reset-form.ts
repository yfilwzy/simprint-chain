import { useState, useCallback } from 'react';
import type { ResetFormData, ResetStep } from '../types';

export interface UseResetFormReturn {
  step: ResetStep;
  formData: ResetFormData;
  setStep: (step: ResetStep) => void;
  setEmail: (email: string) => void;
  setCode: (code: string) => void;
  setNewPassword: (password: string) => void;
  setConfirmPassword: (password: string) => void;
  resetForm: () => void;
}

/**
 * 重置密码表单状态管理 Hook
 */
export function useResetForm(): UseResetFormReturn {
  const [step, setStep] = useState<ResetStep>(1);
  const [formData, setFormData] = useState<ResetFormData>({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  });

  const setEmail = useCallback((email: string) => {
    setFormData((prev) => ({ ...prev, email }));
  }, []);

  const setCode = useCallback((code: string) => {
    setFormData((prev) => ({ ...prev, code }));
  }, []);

  const setNewPassword = useCallback((password: string) => {
    setFormData((prev) => ({ ...prev, newPassword: password }));
  }, []);

  const setConfirmPassword = useCallback((password: string) => {
    setFormData((prev) => ({ ...prev, confirmPassword: password }));
  }, []);

  const resetForm = useCallback(() => {
    setStep(1);
    setFormData({
      email: '',
      code: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, []);

  return {
    step,
    formData,
    setStep,
    setEmail,
    setCode,
    setNewPassword,
    setConfirmPassword,
    resetForm,
  };
}
