import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EMAIL_REGEX } from '../constants';

interface ValidationErrors {
  email: string;
  password: string;
}

interface UseLoginValidationReturn {
  errors: ValidationErrors;
  validateEmail: (email: string) => boolean;
  validatePassword: (password: string) => boolean;
  validateForm: (email: string, password: string) => boolean;
  clearErrors: () => void;
  setEmailError: (error: string) => void;
  setPasswordError: (error: string) => void;
}

/**
 * 登录表单验证 Hook
 */
export function useLoginValidation(): UseLoginValidationReturn {
  const { t } = useTranslation('auth');
  const [errors, setErrors] = useState<ValidationErrors>({
    email: '',
    password: '',
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

  const validatePassword = useCallback(
    (password: string): boolean => {
      if (!password) {
        setErrors((prev) => ({ ...prev, password: t('login.passwordPlaceholder') }));
        return false;
      }

      setErrors((prev) => ({ ...prev, password: '' }));
      return true;
    },
    [t]
  );

  const validateForm = useCallback(
    (email: string, password: string): boolean => {
      const isEmailValid = validateEmail(email);
      const isPasswordValid = validatePassword(password);
      return isEmailValid && isPasswordValid;
    },
    [validateEmail, validatePassword]
  );

  const clearErrors = useCallback(() => {
    setErrors({
      email: '',
      password: '',
    });
  }, []);

  const setEmailError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, email: error }));
  }, []);

  const setPasswordError = useCallback((error: string) => {
    setErrors((prev) => ({ ...prev, password: error }));
  }, []);

  return {
    errors,
    validateEmail,
    validatePassword,
    validateForm,
    clearErrors,
    setEmailError,
    setPasswordError,
  };
}
