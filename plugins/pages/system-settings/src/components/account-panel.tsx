import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Shield,
  Phone,
  Calendar,
  MapPin,
  Lock,
  Timer,
  KeyRound,
  ChevronRight,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingCard } from './setting-card';
import { SettingRow } from './setting-row';
import { getCurrentUser, type CurrentUserResponse } from '../api/users';
import { EditProfileDialog } from './edit-profile-dialog';
import { ChangePasswordDialog } from './change-password-dialog';
import {
  getAccountSecuritySettings,
  setAccountSecuritySettings,
  LOCK_TIME_OPTIONS,
} from '../../../../services/store/src';

/** 格式化日期为 YYYY-MM-DD */
function formatJoinDate(isoDate?: string): string {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate);
    return d.toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}

/** 手机号脱敏，如 138****8888 */
function maskPhone(phone?: string): string {
  if (!phone) return '—';
  if (phone.length <= 4) return '****';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

/** 从名称获取首字母，如 "张三" -> "张"，"John Doe" -> "JD" */
function getInitials(name: string): string {
  if (!name || name === '—') return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  }
  return trimmed[0].toUpperCase();
}

/**
 * 账户与安全面板
 */
export const AccountPanel: React.FC = () => {
  const { t } = useTranslation('settings');
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockTime, setAutoLockTime] = useState(5);
  const [cleanDataOnExit, setCleanDataOnExit] = useState(false);
  const [securitySettingsLoaded, setSecuritySettingsLoaded] = useState(false);

  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCurrentUser();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    let cancelled = false;
    void getAccountSecuritySettings().then((s) => {
      if (!cancelled) {
        setAutoLockEnabled(s.autoLockEnabled);
        setAutoLockTime(s.autoLockTime);
        setCleanDataOnExit(s.cleanDataOnExit);
        setSecuritySettingsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAutoLockChange = useCallback((checked: boolean) => {
    setAutoLockEnabled(checked);
    void setAccountSecuritySettings({ autoLockEnabled: checked });
  }, []);

  const handleAutoLockTimeChange = useCallback((value: string) => {
    const num = Number(value);
    setAutoLockTime(num);
    void setAccountSecuritySettings({ autoLockTime: num });
  }, []);

  const handleCleanDataOnExitChange = useCallback((checked: boolean) => {
    setCleanDataOnExit(checked);
    void setAccountSecuritySettings({ cleanDataOnExit: checked });
  }, []);

  const avatarUrl = user?.avatar_url ?? '';
  const displayName = user?.nickname || user?.email?.split('@')[0] || '—';
  const displayEmail = user?.email || '—';
  const displayPhone = maskPhone(user?.phone);
  const joinDate = formatJoinDate(user?.created_at);
  const location = '中国';

  return (
    <div className="space-y-6">
      {/* 个人资料 */}
      <SettingCard title={t('accountProfile')} icon={User}>
        {loading ? (
          <>
            <div className="flex items-center gap-4 p-3">
              <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-16 shrink-0 rounded" />
            </div>
            <div className="mt-2 pt-2 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 p-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center border-2 border-primary/20 shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={t('accountProfile')}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-semibold text-primary/80">
                    {getInitials(displayName)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{displayEmail}</p>
              </div>
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium text-primary rounded hover:bg-primary/10 transition-colors shrink-0"
                onClick={() => setEditDialogOpen(true)}
              >
                {t('editProfile')}
              </button>
            </div>

            <div className="mt-2 pt-2">
              <SettingRow icon={Phone} title={t('phone')} description={displayPhone}>
                <button
                  type="button"
                  onClick={() => setEditDialogOpen(true)}
                  className="p-1 rounded hover:bg-accent/50 transition-colors cursor-pointer"
                  aria-label={t('editProfile')}
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </SettingRow>
              <SettingRow icon={Calendar} title={t('joinDate')} description={joinDate}>
                <span />
              </SettingRow>
              <SettingRow icon={MapPin} title={t('location')} description={location}>
                <span />
              </SettingRow>
            </div>
          </>
        )}
      </SettingCard>

      <EditProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={user}
        onSuccess={fetchUser}
      />

      <ChangePasswordDialog
        open={changePasswordDialogOpen}
        onOpenChange={setChangePasswordDialogOpen}
      />

      {/* 安全设置 */}
      <SettingCard title={t('accountSecurity')} icon={Shield}>
        <SettingRow icon={Lock} title={t('changePassword')} description={t('changePasswordDesc')}>
          <button
            type="button"
            onClick={() => setChangePasswordDialogOpen(true)}
            className="p-1 rounded hover:bg-accent/50 transition-colors cursor-pointer"
            aria-label={t('changePassword')}
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </SettingRow>
        <SettingRow icon={Timer} title={t('autoLock')} description={t('autoLockDesc')}>
          <Switch
            checked={autoLockEnabled}
            onCheckedChange={handleAutoLockChange}
            disabled={!securitySettingsLoaded}
          />
        </SettingRow>
        {autoLockEnabled && (
          <div className="flex items-center justify-between p-3 ml-7 bg-accent/20 rounded-lg">
            <span className="text-sm text-foreground">{t('lockTime')}</span>
            <Select
              value={String(autoLockTime)}
              onValueChange={handleAutoLockTimeChange}
              disabled={!securitySettingsLoaded}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCK_TIME_OPTIONS.map((min) => (
                  <SelectItem key={min} value={String(min)}>
                    {t('minutes', { count: min })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <SettingRow icon={KeyRound} title={t('exitClearData')} description={t('exitClearDataDesc')}>
          <Switch
            checked={cleanDataOnExit}
            onCheckedChange={handleCleanDataOnExitChange}
            disabled={!securitySettingsLoaded}
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
};
