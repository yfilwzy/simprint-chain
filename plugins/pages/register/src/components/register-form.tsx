import { type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Lock, ArrowLeft, UserPlus, Send, Key } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TextareaInput } from '@/components/textarea-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { useRegisterForm } from '../hooks/use-register-form';
import { useRegisterValidation } from '../hooks/use-register-validation';
import { useRegisterCode } from '../hooks/use-register-code';
import { useRegister } from '../hooks/use-register';
import { CODE_MAX_LENGTH } from '../constants';

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');

  // 表单状态管理
  const { formData, setEmail, setPassword, setConfirmPassword, setCode } = useRegisterForm();

  // 表单验证
  const { errors, validateForm, validateEmail, clearErrors, setEmailError, setCodeError } =
    useRegisterValidation();

  // 验证码管理
  const { codeSent, countdown, sendCode, resetCode } = useRegisterCode();

  // 注册操作
  const { handleRegister } = useRegister();

  // 处理发送验证码
  const handleSendCode = async () => {
    clearErrors();

    // 验证邮箱
    if (!validateEmail(formData.email)) {
      return;
    }

    try {
      await sendCode(formData.email);
    } catch (error: any) {
      setEmailError(error?.message || error?.toString() || '发送验证码失败');
    }
  };

  // 处理邮箱变化
  const handleEmailChange = (value: string) => {
    setEmail(value);
    clearErrors();
    resetCode();
    setCode('');
  };

  // 处理表单提交
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 清除之前的错误
    clearErrors();

    // 验证表单
    if (!validateForm(formData, codeSent)) {
      return;
    }

    // 执行注册
    try {
      await handleRegister(formData);
    } catch (error: any) {
      console.error('注册失败:', error);
      const errorMessage = error?.message || error?.toString() || '注册失败，请重试';
      setCodeError(errorMessage);
    }
  };

  return (
    <>
      <div className="text-center mb-10">
        <h1 className="mb-2 tracking-tight">{t('register.title')}</h1>
        <p className="text-muted-foreground">{t('register.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="registerEmail">邮箱地址</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <TextareaInput
              id="registerEmail"
              placeholder="请输入您的邮箱"
              value={formData.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              aria-invalid={!!errors.email}
              className="pl-9"
              required
            />
          </div>
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="registerCode">验证码</Label>
          {!codeSent ? (
            // 默认状态：只显示发送验证码按钮
            <Button type="button" variant="outline" onClick={handleSendCode} className="w-full h-9">
              <Send className="size-4 mr-2" />
              发送验证码
            </Button>
          ) : (
            // 发送后：显示输入框
            <div className="space-y-2">
              {countdown > 0 ? (
                // 倒计时中：只显示输入框
                <>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <TextareaInput
                      id="registerCode"
                      placeholder="请输入验证码"
                      value={formData.code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        clearErrors();
                      }}
                      aria-invalid={!!errors.code}
                      className="pl-9"
                      required
                      maxLength={CODE_MAX_LENGTH}
                    />
                  </div>
                  {errors.code && <p className="text-sm text-destructive">{errors.code}</p>}
                  <p className="text-sm text-muted-foreground">
                    验证码已发送，{countdown} 秒后可重新发送
                  </p>
                </>
              ) : (
                // 过期后：输入框和发送按钮在同一行
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <TextareaInput
                      id="registerCode"
                      placeholder="请输入验证码"
                      value={formData.code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        clearErrors();
                      }}
                      aria-invalid={!!errors.code}
                      className="pl-9"
                      required
                      maxLength={CODE_MAX_LENGTH}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendCode}
                    className="shrink-0 h-9"
                  >
                    <Send className="size-4 mr-2" />
                    发送验证码
                  </Button>
                </div>
              )}
              {errors.code && countdown === 0 && (
                <p className="text-sm text-destructive">{errors.code}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="registerPassword">密码</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="password"
              id="registerPassword"
              placeholder="至少8个字符"
              value={formData.password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearErrors();
              }}
              aria-invalid={!!errors.password}
              className="pl-9"
              required
              minLength={8}
            />
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="registerConfirmPassword">确认密码</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="password"
              id="registerConfirmPassword"
              placeholder="请再次输入密码"
              value={formData.confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                clearErrors();
              }}
              aria-invalid={!!errors.confirmPassword}
              className="pl-9"
              required
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword}</p>
          )}
        </div>

        <div className="flex gap-3 flex-row-reverse">
          <Button type="submit" className="flex-1">
            <UserPlus className="size-4" />
            注册
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate('/auth/login')}
            title="返回登录"
          >
            <ArrowLeft className="size-4" />
          </Button>
        </div>
      </form>
    </>
  );
};
