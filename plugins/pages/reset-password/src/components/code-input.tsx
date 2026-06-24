import { Key, Send } from 'lucide-react';
import { TextareaInput } from '@/components/textarea-input';
import { Button } from '@/components/ui/button';
import { CODE_MAX_LENGTH } from '../constants';

interface CodeInputProps {
  code: string;
  countdown: number;
  error?: string;
  onCodeChange: (code: string) => void;
  onResend: () => void;
}

/**
 * 验证码输入组件
 */
export const CodeInput: React.FC<CodeInputProps> = ({
  code,
  countdown,
  error,
  onCodeChange,
  onResend,
}) => {
  if (countdown > 0) {
    // 倒计时中：只显示输入框
    return (
      <>
        <div className="relative">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <TextareaInput
            id="resetCode"
            placeholder="请输入验证码"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            aria-invalid={!!error}
            className="pl-9"
            required
            maxLength={CODE_MAX_LENGTH}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-sm text-muted-foreground">验证码已发送，{countdown} 秒后可重新发送</p>
      </>
    );
  }

  // 过期后：输入框和发送按钮在同一行
  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <TextareaInput
            id="resetCode"
            placeholder="请输入验证码"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            aria-invalid={!!error}
            className="pl-9"
            required
            maxLength={CODE_MAX_LENGTH}
          />
        </div>
        <Button type="button" variant="outline" onClick={onResend} className="shrink-0 h-9">
          <Send className="size-4 mr-2" />
          发送验证码
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
};
