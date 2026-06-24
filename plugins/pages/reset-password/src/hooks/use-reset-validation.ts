import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EMAIL_REGEX, MIN_PASSWORD_LENGTH } from '../constants';

interface ValidationErrors {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}

export interface UseResetValidationReturn {
  errors: ValidationErrors;
  validateEmail: (email: string) => boolean;
  validatePassword: (password: string) => boolean;
  validateConfirmPassword: (password: string, confirmPassword: string) => boolean;
  validateCode: (code: string) => boolean;
  validateStep1: (email: string) => boolean;
  validateStep2: (formData: {
    code: string;
    newPassword: string;
    confirmPassword: string;
  }) => boolean;
  clearErrors: () => void;
  setEmailError: (error: string) => void;
  setCodeError: (error: string) => void;
  setPasswordError: (error: string) => void;
  setConfirmPasswordError: (error: string) => void;
}

/**
 * 重置密码表单验证 Hook
 */
export function useResetValidation(): UseResetValidationReturn {
  const { t } = useTranslation('auth');
  const [errors, setErrors] = useState<ValidationErrors>({
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
  });

  const validateEmail = useCallback(
    (email: string): boolean => {
      if (!email) {
        setErrors((prev) => ({ ...prev, email: t('login.err.emailRequired') }));
        return false;
      }

      if (!EMAIL_REGEX.test(email)) {
        setErrors((prev) => ({ ...prev, email: t('login.err.emailInvalid') }));
        return false;
      }

      setErrors((prev) => ({ ...prev, email: '' }));
      return true;
    },
    [t]
  );

  const validatePassword = useCallback((password: string): boolean => {
    if (!password) {
      setErrors((prev) => ({ ...prev, password: '请输入新密码' }));
      return false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrors((prev) => ({ ...prev, password: `密码至少需要${MIN_PASSWORD_LENGTH}个字符` }));
      return false;
    }

    setErrors((prev) => ({ ...prev, password: '' }));
    return true;
  }, []);

  const validateConfirmPassword = useCallback(
    (password: string, confirmPassword: string): boolean => {
      if (!confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: '请再次输入密码' }));
        return false;
      }

      if (password !== confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: '两次输入的密码不一致' }));
        return false;
      }

      setErrors((prev) => ({ ...prev, confirmPassword: '' }));
      return true;
    },
    []
  );

  const validateCode = useCallback((code: string): boolean => {
    if (!code) {
      setErrors((prev) => ({ ...prev, code: '请输入验证码' }));
      return false;
    }

    setErrors((prev) => ({ ...prev, code: '' }));
    return true;
  }, []);

  const validateStep1 = useCallback(
    (email: string): boolean => {
      return validateEmail(email);
    },
    [validateEmail]
  );

  const validateStep2 = useCallback(
    (formData: { code: string; newPassword: string; confirmPassword: string }): boolean => {
      const isCodeValid = validateCode(formData.code);
      const isPasswordValid = validatePassword(formData.newPassword);
      const isConfirmPasswordValid = validateConfirmPassword(
        formData.newPassword,
        formData.confirmPassword
      );
      return isCodeValid && isPasswordValid && isConfirmPasswordValid;
    },
    [validateCode, validatePassword, validateConfirmPassword]
  );

  const clearErrors = useCallback(() => {
    setErrors({
      email: '',
      code: '',
      password: '',
      confirmPassword: '',
    });
  }, []);

  const setEmailError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, email: error }));
  }, []);

  const setCodeError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, code: error }));
  }, []);

  const setPasswordError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, password: error }));
  }, []);

  const setConfirmPasswordError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, confirmPassword: error }));
  }, []);

  return {
    errors,
    validateEmail,
    validatePassword,
    validateConfirmPassword,
    validateCode,
    validateStep1,
    validateStep2,
    clearErrors,
    setEmailError,
    setCodeError,
    setPasswordError,
    setConfirmPasswordError,
  };
}
