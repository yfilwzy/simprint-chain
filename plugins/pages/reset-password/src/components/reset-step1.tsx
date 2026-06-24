import { Mail, ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router';
import { TextareaInput } from '@/components/textarea-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

interface ResetStep1Props {
  email: string;
  emailError?: string;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
}

/**
 * 重置密码第一步：发送验证码
 */
export const ResetStep1: React.FC<ResetStep1Props> = ({
  email,
  emailError,
  onEmailChange,
  onSubmit,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="resetEmail">邮箱地址</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <TextareaInput
            id="resetEmail"
            placeholder="请输入您的注册邮箱"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            aria-invalid={!!emailError}
            className="pl-9"
            required
          />
        </div>
        {emailError && <p className="text-sm text-destructive">{emailError}</p>}
      </div>

      <p className="text-muted-foreground leading-relaxed" style={{ fontSize: '10px' }}>
        {t('reset.hint')}
      </p>

      <div className="flex gap-3 flex-row-reverse">
        <Button type="button" onClick={onSubmit} className="flex-1">
          <Send className="size-4" />
          {t('reset.sendCode')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => navigate('/auth/login')}
          title={t('reset.backToLogin')}
        >
          <ArrowLeft className="size-4" />
        </Button>
      </div>
    </>
  );
};
