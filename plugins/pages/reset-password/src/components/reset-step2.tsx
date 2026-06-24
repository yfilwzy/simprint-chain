import { ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CodeInput } from './code-input';

interface ResetStep2Props {
  code: string;
  newPassword: string;
  confirmPassword: string;
  countdown: number;
  codeError?: string;
  passwordError?: string;
  confirmPasswordError?: string;
  onCodeChange: (code: string) => void;
  onNewPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
  onResendCode: () => void;
}

/**
 * 重置密码第二步：输入验证码和新密码
 */
export const ResetStep2: React.FC<ResetStep2Props> = ({
  code,
  newPassword,
  confirmPassword,
  countdown,
  codeError,
  passwordError,
  confirmPasswordError,
  onCodeChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onResendCode,
}) => {
  const navigate = useNavigate();

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="resetCode">验证码</Label>
        <div className="space-y-2">
          <CodeInput
            code={code}
            countdown={countdown}
            error={codeError}
            onCodeChange={onCodeChange}
            onResend={onResendCode}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resetNewPassword">新密码</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="password"
            id="resetNewPassword"
            placeholder="至少8个字符"
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
            aria-invalid={!!passwordError}
            className="pl-9"
            required
            minLength={8}
          />
        </div>
        {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="resetConfirmPassword">确认密码</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="password"
            id="resetConfirmPassword"
            placeholder="请再次输入密码"
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            aria-invalid={!!confirmPasswordError}
            className="pl-9"
            required
          />
        </div>
        {confirmPasswordError && <p className="text-sm text-destructive">{confirmPasswordError}</p>}
      </div>

      <div className="flex gap-3 flex-row-reverse">
        <Button type="submit" className="flex-1">
          重置密码
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
    </>
  );
};
