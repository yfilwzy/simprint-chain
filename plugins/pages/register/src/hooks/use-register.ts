import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth, useLoading } from '../../../../services/store/src';
import { useTranslation } from 'react-i18next';
import type { RegisterFormData } from '../types';
import { register } from '../api';

interface UseRegisterReturn {
  handleRegister: (formData: RegisterFormData) => Promise<void>;
}

/**
 * 从邮箱提取用户名（@前面的部分）
 */
const getUsernameFromEmail = (email: string): string => {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[0];
};

/**
 * 注册操作 Hook
 */
export function useRegister(): UseRegisterReturn {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { setLoading } = useLoading();
  useTranslation('auth'); // 注册 i18n namespace

  const handleRegister = useCallback(
    async (formData: RegisterFormData) => {
      setLoading(true);

      try {
        // 通过 Tauri 命令注册（会自动处理公钥、机器信息和 token 保存）
        const responseData = await register(formData.email, formData.password, formData.code);

        // 解析用户信息
        if (responseData.user_info) {
          const userInfo = responseData.user_info;
          const username = getUsernameFromEmail(userInfo.email || formData.email);
          setUser({
            uuid: userInfo.uuid || '',
            id: userInfo.id || '',
            nickname: userInfo.nickname || username,
            email: userInfo.email || formData.email,
            phone: userInfo.phone,
            avatar: userInfo.avatar_hash,
            status: userInfo.status || 'active',
          });
        } else {
          // 如果没有用户信息，使用邮箱提取的用户名
          const username = getUsernameFromEmail(formData.email);
          setUser({
            uuid: '',
            id: username,
            nickname: username,
            email: formData.email,
            status: 'active',
          });
        }

        // 注册成功后跳转到首页
        navigate('/');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '注册失败';
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [navigate, setUser, setLoading]
  );

  return {
    handleRegister,
  };
}
