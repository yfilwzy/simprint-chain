import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, UserPlus, Mail, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeamDialogStore } from '../stores';
import type { TeamMember } from '../types';
import { cn } from '@/lib/utils';

interface TeamInviteDialogProps {
  open: boolean;
  email: string;
  role: TeamMember['role'];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: TeamMember['role']) => void;
  onSubmit: () => void;
}

// 邮箱格式验证（要求后缀必须是小写，如 .com, .org, .net 等）
function isValidEmail(email: string): boolean {
  // 正则表达式要求：
  // - 用户名部分：一个或多个非空白、非@字符
  // - @ 符号
  // - 域名部分：一个或多个非空白、非@字符，至少包含一个点
  // - TLD（顶级域名）：必须是小写字母，至少2个字符
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * 邀请成员对话框组件
 */
export const TeamInviteDialog: React.FC<TeamInviteDialogProps> = ({
  open,
  email,
  role,
  submitting,
  onOpenChange,
  onEmailChange,
  onRoleChange,
  onSubmit,
}) => {
  const { t } = useTranslation('team');
  const dialogStore = useTeamDialogStore();
  const [emailError, setEmailError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const emailInputRef = useRef<HTMLTextAreaElement>(null);

  // 当对话框打开时，聚焦邮箱输入框
  useEffect(() => {
    if (open && emailInputRef.current) {
      // 延迟聚焦，确保对话框动画完成
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // 邮箱验证
  useEffect(() => {
    if (touched && email) {
      if (!isValidEmail(email)) {
        setEmailError('请输入有效的邮箱地址');
      } else {
        setEmailError(null);
      }
    } else {
      setEmailError(null);
    }
  }, [email, touched]);

  const handleEmailChange = (value: string) => {
    onEmailChange(value);
    if (!touched) {
      setTouched(true);
    }
  };

  const handleSubmit = () => {
    if (!email.trim()) {
      setTouched(true);
      setEmailError('请输入邮箱地址');
      emailInputRef.current?.focus();
      return;
    }
    if (!isValidEmail(email)) {
      setTouched(true);
      setEmailError('请输入有效的邮箱地址');
      emailInputRef.current?.focus();
      return;
    }
    onSubmit();
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      dialogStore.closeInviteDialog();
      // 重置状态
      setTouched(false);
      setEmailError(null);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={handleClose}
      minWidth="min-w-[420px]"
      header={{
        icon: UserPlus,
        title: t('dialog.invite.title'),
        description: t('dialog.invite.description'),
      }}
    >
      <div className="space-y-4">
        {/* 邮箱输入 */}
        <div className="space-y-1.5">
          <Label
            htmlFor="invite-email"
            className="text-xs font-medium text-foreground flex items-center gap-1.5"
          >
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            {t('dialog.invite.email')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <TextareaInput
              ref={emailInputRef}
              id="invite-email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder={t('dialog.invite.emailPlaceholder') || 'user@example.com'}
              aria-invalid={!!emailError}
              className={cn(
                'py-[2px]',
                emailError ? 'pl-9 border-destructive focus-visible:ring-destructive/50' : 'pl-9'
              )}
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !emailError && email.trim() && !submitting) {
                  // TextareaInput 是 textarea，默认 Enter 会换行；这里阻止默认行为并提交
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
        </div>

        {/* 角色选择 */}
        <div className="space-y-1.5">
          <Label htmlFor="invite-role" className="text-xs font-medium text-foreground">
            {t('dialog.invite.role')}
          </Label>
          <Select
            value={role}
            onValueChange={(v) => onRoleChange(v as TeamMember['role'])}
            disabled={submitting}
          >
            <SelectTrigger id="invite-role" className="w-full h-9 text-sm">
              <SelectValue placeholder={t('dialog.invite.rolePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{t('role.admin')}</SelectItem>
              <SelectItem value="editor">{t('role.editor')}</SelectItem>
              <SelectItem value="viewer">{t('role.viewer')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => handleClose(false)}
          disabled={submitting}
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          {t('dialog.invite.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleSubmit}
          disabled={submitting || !email.trim() || !!emailError}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('dialog.invite.submitting')}
            </>
          ) : (
            t('dialog.invite.submit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
};
