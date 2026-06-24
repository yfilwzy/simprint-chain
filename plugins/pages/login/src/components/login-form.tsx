import { type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Lock, UserPlus, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TextareaInput } from '@/components/textarea-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';
import { useTranslation } from 'react-i18next';
import { useLoginForm } from '../hooks/use-login-form';
import { useLoginValidation } from '../hooks/use-login-validation';
import { useLogin } from '../hooks/use-login';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');

  // 表单状态管理
  const { formData, setEmail, setPassword, setRememberPassword } = useLoginForm();

  // 表单验证
  const { errors, validateForm, clearErrors, setPasswordError } = useLoginValidation();

  // 登录操作
  const { handleLogin } = useLogin();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 清除之前的错误
    clearErrors();

    // 验证表单
    if (!validateForm(formData.email, formData.password)) {
      return;
    }

    // 执行登录
    try {
      await handleLogin(formData);
    } catch (error: any) {
      setPasswordError(error.message || t('login.err.failed'));
    }
  };

  return (
    <>
      <div className="text-center mb-10">
        <h1 className="mb-2 tracking-tight">{t('login.title')}</h1>
        <p className="text-muted-foreground">{t('login.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="loginEmail">{t('login.emailLabel')}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <TextareaInput
              id="loginEmail"
              placeholder={t('login.emailPlaceholder')}
              value={formData.email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearErrors();
              }}
              aria-invalid={!!errors.email}
              className="pl-9"
              required
            />
          </div>
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="loginPassword">{t('login.passwordLabel')}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="password"
              id="loginPassword"
              placeholder={t('login.passwordPlaceholder')}
              value={formData.password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearErrors();
              }}
              aria-invalid={!!errors.password}
              className="pl-9"
              required
            />
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberPassword"
                checked={formData.rememberPassword}
                onCheckedChange={(checked) => setRememberPassword(checked === true)}
              />
              <Label htmlFor="rememberPassword" className="font-normal cursor-pointer">
                {t('login.remember')}
              </Label>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-primary transition-colors"
              onClick={() => navigate('/auth/reset-password')}
            >
              {t('login.forgot')}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" className="flex-1">
            <LogIn className="size-4" />
            {t('login.submit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate('/auth/register')}
            title={t('login.register')}
          >
            <UserPlus className="size-4" />
          </Button>
        </div>
      </form>
    </>
  );
};
