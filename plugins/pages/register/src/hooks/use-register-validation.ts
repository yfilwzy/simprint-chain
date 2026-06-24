import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EMAIL_REGEX, MIN_PASSWORD_LENGTH } from '../constants';

interface ValidationErrors {
  email: string;
  password: string;
  confirmPassword: string;
  code: string;
}

interface UseRegisterValidationReturn {
  errors: ValidationErrors;
  validateEmail: (email: string) => boolean;
  validatePassword: (password: string) => boolean;
  validateConfirmPassword: (password: string, confirmPassword: string) => boolean;
  validateCode: (code: string, codeSent: boolean) => boolean;
  validateForm: (
    formData: { email: string; password: string; confirmPassword: string; code: string },
    codeSent: boolean
  ) => boolean;
  clearErrors: () => void;
  setEmailError: (error: string) => void;
  setPasswordError: (error: string) => void;
  setConfirmPasswordError: (error: string) => void;
  setCodeError: (error: string) => void;
}

/**
 * 注册表单验证 Hook
 */
export function useRegisterValidation(): UseRegisterValidationReturn {
  useTranslation('auth'); // 注册 i18n namespace
  const [errors, setErrors] = useState<ValidationErrors>({
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
  });

  const validateEmail = useCallback((email: string): boolean => {
    if (!email) {
      setErrors((prev) => ({ ...prev, email: '请输入邮箱地址' }));
      return false;
    }

    if (!EMAIL_REGEX.test(email)) {
      setErrors((prev) => ({ ...prev, email: '请输入有效的邮箱地址' }));
      return false;
    }

    setErrors((prev) => ({ ...prev, email: '' }));
    return true;
  }, []);

  const validatePassword = useCallback((password: string): boolean => {
    if (!password) {
      setErrors((prev) => ({ ...prev, password: '请输入密码' }));
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

  const validateCode = useCallback((code: string, codeSent: boolean): boolean => {
    if (!codeSent) {
      setErrors((prev) => ({ ...prev, code: '请先发送验证码' }));
      return false;
    }

    if (!code) {
      setErrors((prev) => ({ ...prev, code: '请输入验证码' }));
      return false;
    }

    setErrors((prev) => ({ ...prev, code: '' }));
    return true;
  }, []);

  const validateForm = useCallback(
    (
      formData: { email: string; password: string; confirmPassword: string; code: string },
      codeSent: boolean
    ): boolean => {
      const isEmailValid = validateEmail(formData.email);
      const isPasswordValid = validatePassword(formData.password);
      const isConfirmPasswordValid = validateConfirmPassword(
        formData.password,
        formData.confirmPassword
      );
      const isCodeValid = validateCode(formData.code, codeSent);
      return isEmailValid && isPasswordValid && isConfirmPasswordValid && isCodeValid;
    },
    [validateEmail, validatePassword, validateConfirmPassword, validateCode]
  );

  const clearErrors = useCallback(() => {
    setErrors({
      email: '',
      password: '',
      confirmPassword: '',
      code: '',
    });
  }, []);

  const setEmailError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, email: error }));
  }, []);

  const setPasswordError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, password: error }));
  }, []);

  const setConfirmPasswordError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, confirmPassword: error }));
  }, []);

  const setCodeError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, code: error }));
  }, []);

  return {
    errors,
    validateEmail,
    validatePassword,
    validateConfirmPassword,
    validateCode,
    validateForm,
    clearErrors,
    setEmailError,
    setPasswordError,
    setConfirmPasswordError,
    setCodeError,
  };
}
