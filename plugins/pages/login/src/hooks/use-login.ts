import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth, useLoading } from '../../../../services/store/src';
import type { LoginFormData } from '../types';
import { login, saveRememberedCredential, clearRememberedCredential } from '../api';

interface UseLoginReturn {
  handleLogin: (formData: LoginFormData) => Promise<void>;
}

/**
 * 登录操作 Hook
 */
export function useLogin(): UseLoginReturn {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { setLoading } = useLoading();
  const { t } = useTranslation('auth');

  const handleLogin = useCallback(
    async (formData: LoginFormData) => {
      setLoading(true);

      try {
        const responseData = await login(formData.email, formData.password);

        // 根据"记住密码"选项处理凭证
        if (formData.rememberPassword && responseData.refresh_token) {
          // 如果勾选了"记住密码"，保存 refresh_token
          try {
            await saveRememberedCredential(formData.email, responseData.refresh_token);
          } catch (error) {
            console.warn('保存记住的凭证失败:', error);
            // 不影响登录流程，只记录警告
          }
        } else {
          // 如果未勾选"记住密码"，清除已保存的凭证
          await clearRememberedCredential();
        }

        // 更新 store 中的用户状态
        if (responseData.user_info) {
          const userInfo = responseData.user_info;
          setUser({
            uuid: userInfo.uuid || '',
            id: userInfo.id || '',
            nickname: userInfo.nickname,
            email: userInfo.email || formData.email,
            phone: userInfo.phone,
            avatar: userInfo.avatar_hash,
            status: userInfo.status || 'active',
            current_workspace_uuid: userInfo.current_workspace?.uuid || null,
            current_team_uuid: userInfo.current_team?.uuid || null,
          });
        } else {
          // 如果没有用户信息，使用邮箱作为基本信息
          setUser({
            uuid: '',
            id: formData.email.split('@')[0],
            email: formData.email,
            status: 'active',
            current_workspace_uuid: null,
            current_team_uuid: null,
          });
        }

        // 登录成功后跳转到首页
        navigate('/');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t('login.err.failed');
        toast.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [navigate, setUser, setLoading, t]
  );

  return {
    handleLogin,
  };
}
