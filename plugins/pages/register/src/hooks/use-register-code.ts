import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useLoading } from '../../../../services/store/src';
import { sendVerificationCode } from '../api';
import { CODE_COUNTDOWN_SECONDS } from '../constants';

interface UseRegisterCodeReturn {
  codeSent: boolean;
  countdown: number;
  sendCode: (email: string) => Promise<void>;
  resetCode: () => void;
}

/**
 * 注册验证码管理 Hook
 */
export function useRegisterCode(): UseRegisterCodeReturn {
  const { setLoading } = useLoading();
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendCode = useCallback(
    async (email: string) => {
      setLoading(true);

      try {
        await sendVerificationCode(email, 'register');
        setCodeSent(true);
        setCountdown(CODE_COUNTDOWN_SECONDS);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '发送验证码失败';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading]
  );

  const resetCode = useCallback(() => {
    setCodeSent(false);
    setCountdown(0);
  }, []);

  return {
    codeSent,
    countdown,
    sendCode,
    resetCode,
  };
}
