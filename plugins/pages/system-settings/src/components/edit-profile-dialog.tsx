import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, User, X, Save } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TextareaInput } from '@/components/textarea-input';
import { toast } from 'sonner';
import { updateCurrentUser, type CurrentUserResponse } from '../api/users';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CurrentUserResponse | null;
  onSuccess: () => void;
}

/** 严格邮箱格式：本地部分 + @ + 域名 + 至少2位顶级域名 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
/** 中国大陆手机号：1 开头，第二位 3-9，共 11 位数字 */
const PHONE_REGEX = /^1[3-9]\d{9}$/;

function validateEmail(value: string): { valid: boolean; message?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, message: 'editProfileEmailRequired' };
  if (trimmed.length > 254) return { valid: false, message: 'editProfileInvalidEmail' };
  if (!EMAIL_REGEX.test(trimmed)) return { valid: false, message: 'editProfileInvalidEmail' };
  return { valid: true };
}

function validatePhone(value: string): { valid: boolean; message?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true }; // 可选字段，空则通过
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 11 || !PHONE_REGEX.test(digits)) {
    return { valid: false, message: 'editProfileInvalidPhone' };
  }
  return { valid: true };
}

export function EditProfileDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditProfileDialogProps) {
  const { t } = useTranslation('settings');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && user) {
      setNickname(user.nickname ?? '');
      setPhone(user.phone ?? '');
      setEmail(user.email ?? '');
    }
  }, [open, user]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      toast.error(t(emailResult.message!) || '请输入有效的邮箱地址');
      return;
    }

    const phoneResult = validatePhone(phone);
    if (!phoneResult.valid) {
      toast.error(t(phoneResult.message!) || '请输入有效的手机号');
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!user) return;

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      toast.error(t(emailResult.message!) || '请输入有效的邮箱地址');
      return;
    }
    const phoneResult = validatePhone(phone);
    if (!phoneResult.valid) {
      toast.error(t(phoneResult.message!) || '请输入有效的手机号');
      return;
    }

    setSubmitting(true);
    setConfirmOpen(false);
    try {
      const trimmedEmail = email.trim();
      const result = await updateCurrentUser({
        nickname: nickname.trim() || undefined,
        phone: phone.trim() ? phone.trim().replace(/\D/g, '') : undefined,
        email: trimmedEmail || undefined,
      });

      if (result.ok) {
        toast.success(t('editProfileSuccess') || '资料更新成功');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.message || t('editProfileFailed') || '更新失败');
      }
    } catch {
      toast.error(t('editProfileFailed') || '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <FormattedDialog
        open={open}
        onOpenChange={onOpenChange}
        header={{
          icon: User,
          title: t('editProfile'),
          description: t('editProfileDesc'),
        }}
        contentPadding="p-5"
      >
        <form id="edit-profile-form" onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-nickname" className="text-xs text-muted-foreground">
              {t('nickname')} <span className="text-destructive">*</span>
            </Label>
            <TextareaInput
              id="edit-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('nicknamePlaceholder')}
              className="text-sm min-h-9"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="text-xs text-muted-foreground">
              {t('phone')}
            </Label>
            <TextareaInput
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
              className="text-sm min-h-9"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email" className="text-xs text-muted-foreground">
              {t('email')} <span className="text-destructive">*</span>
            </Label>
            <TextareaInput
              id="edit-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="text-sm min-h-9"
              disabled={submitting}
            />
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
            form="edit-profile-form"
            disabled={submitting}
          >
            {t('save')}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>

      <FormattedDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        minWidth="min-w-[440px]"
        header={{
          icon: Save,
          title: t('editProfileConfirmTitle'),
          description: t('editProfileConfirmDesc'),
        }}
        contentPadding="p-5"
      >
        <FormattedDialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setConfirmOpen(false)}
            disabled={submitting}
          >
            <X className="h-4 w-4 mr-1.5" />
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            onClick={() => void handleConfirmSave()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t('saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" />
                {t('save')}
              </>
            )}
          </Button>
        </FormattedDialogFooter>
      </FormattedDialog>
    </>
  );
}
