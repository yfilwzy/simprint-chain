import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Lock } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updatePassword } from '../api/users';

const MIN_PASSWORD_LENGTH = 8;

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  onSuccess,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation('settings');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open]);

  const validate = (): boolean => {
    if (!oldPassword.trim()) {
      toast.error(t('changePasswordOldRequired') || '请输入原密码');
      return false;
    }
    if (!newPassword.trim()) {
      toast.error(t('changePasswordNewRequired') || '请输入新密码');
      return false;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        t('changePasswordMinLength', { count: MIN_PASSWORD_LENGTH }) ||
          `密码至少需要${MIN_PASSWORD_LENGTH}个字符`
      );
      return false;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('changePasswordMismatch') || '两次输入的新密码不一致');
      return false;
    }
    if (oldPassword === newPassword) {
      toast.error(t('changePasswordSameAsOld') || '新密码不能与原密码相同');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await updatePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });

      if (result.ok) {
        toast.success(t('changePasswordSuccess') || '密码修改成功');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.message || t('changePasswordFailed') || '修改密码失败');
      }
    } catch {
      toast.error(t('changePasswordFailed') || '修改密码失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      header={{
        icon: Lock,
        title: t('changePassword'),
        description: t('changePasswordDesc'),
      }}
      contentPadding="p-5"
    >
      <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="old-password" className="text-xs text-muted-foreground">
            {t('changePasswordOld')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder={t('changePasswordOldPlaceholder')}
              className="pl-9 h-9 text-sm"
              disabled={submitting}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-xs text-muted-foreground">
            {t('changePasswordNew')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('changePasswordNewPlaceholder')}
              className="pl-9 h-9 text-sm"
              disabled={submitting}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">
            {t('changePasswordConfirm')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('changePasswordConfirmPlaceholder')}
              className="pl-9 h-9 text-sm"
              disabled={submitting}
            />
          </div>
        </div>
      </form>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          {t('cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          type="submit"
          form="change-password-form"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('saving')}
            </>
          ) : (
            t('changePasswordSubmit')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
