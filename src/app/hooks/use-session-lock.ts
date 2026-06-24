import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../plugins/services/store/src';
import { verifyCurrentUserPassword } from '../../../plugins/pages/system-settings/src/api/users';
import { invoke, reportUserActivity } from '@/lib/tauri';

interface SessionLockState {
  isLocked: boolean;
  unlocking: boolean;
  error: string | null;
  unlock: (password: string) => Promise<void>;
}

interface SessionLockPayload {
  locked: boolean;
  lockedAtMs?: number | null;
}

export function useSessionLock(enabled: boolean): SessionLockState {
  const { t } = useTranslation('settings');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authRef = useRef(isAuthenticated);
  const [isLocked, setIsLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;
    let unlistenLocked: (() => void) | undefined;
    let unlistenUnlocked: (() => void) | undefined;

    const setup = async () => {
      const state = await invoke<SessionLockPayload>('get_session_lock_state');
      if (disposed) {
        return;
      }

      if (authRef.current) {
        setIsLocked(Boolean(state.locked));
      } else if (state.locked) {
        await invoke('unlock_session');
      }

      unlistenLocked = await listen<SessionLockPayload>('session_locked', async () => {
        if (!authRef.current) {
          await invoke('unlock_session');
          return;
        }

        setError(null);
        setIsLocked(true);
      });

      unlistenUnlocked = await listen<SessionLockPayload>('session_unlocked', () => {
        setError(null);
        setIsLocked(false);
      });
    };

    void setup();

    return () => {
      disposed = true;
      unlistenLocked?.();
      unlistenUnlocked?.();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!isAuthenticated) {
      setError(null);
      setIsLocked(false);
      void invoke('unlock_session');
      return;
    }

    void reportUserActivity('ui');
  }, [enabled, isAuthenticated]);

  useEffect(() => {
    if (!enabled || !isAuthenticated) {
      return;
    }

    const handleUserActivity = () => {
      void reportUserActivity('ui');
    };

    window.addEventListener('keydown', handleUserActivity, true);
    window.addEventListener('pointerdown', handleUserActivity, true);
    window.addEventListener('pointermove', handleUserActivity, true);
    window.addEventListener('wheel', handleUserActivity, true);

    return () => {
      window.removeEventListener('keydown', handleUserActivity, true);
      window.removeEventListener('pointerdown', handleUserActivity, true);
      window.removeEventListener('pointermove', handleUserActivity, true);
      window.removeEventListener('wheel', handleUserActivity, true);
    };
  }, [enabled, isAuthenticated]);

  const unlock = useCallback(async (password: string) => {
    if (!password.trim()) {
      setError(t('sessionLock.passwordRequired'));
      return;
    }

    setUnlocking(true);
    setError(null);

    try {
      const result = await verifyCurrentUserPassword({ password });
      if (!result.ok) {
        setError(result.message || t('sessionLock.unlockFailed'));
        return;
      }

      if (!result.valid) {
        setError(t('sessionLock.invalidPassword'));
        return;
      }

      await invoke('unlock_session');
      setIsLocked(false);
    } finally {
      setUnlocking(false);
    }
  }, [t]);

  return {
    isLocked,
    unlocking,
    error,
    unlock,
  };
}
