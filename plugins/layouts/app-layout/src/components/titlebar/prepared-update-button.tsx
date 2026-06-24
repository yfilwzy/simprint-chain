import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { invoke } from '@/lib/tauri';
import { listen } from '@tauri-apps/api/event';

interface PreparedUpdateInfo {
  kind: string;
  version: string;
  restartRequired: boolean;
}

export function PreparedUpdateButton() {
  const { t } = useTranslation('appLayout');
  const [update, setUpdate] = useState<PreparedUpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const preparedUpdate = await invoke<PreparedUpdateInfo | null>('get_prepared_update');
      if (!disposed && preparedUpdate) {
        setUpdate(preparedUpdate);
        setError(null);
      }

      unlisten = await listen<PreparedUpdateInfo>('app-update-ready', (event) => {
        if (disposed) {
          return;
        }

        setUpdate(event.payload);
        setError(null);
      });
    };

    void setup();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const handleInstall = async () => {
    if (!update) {
      return;
    }

    setInstalling(true);
    setError(null);

    try {
      await invoke('start_prepared_update_install', {
        kind: update.kind,
      });
    } catch (installError) {
      const message =
        installError instanceof Error ? installError.message : t('update.installStartFailed');
      setError(message);
      setInstalling(false);
    }
  };

  if (!update) {
    return null;
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="relative w-8 h-8 flex items-center justify-center text-primary/90 hover:bg-accent/80 hover:text-primary transition-all duration-200 ease-in-out rounded-sm cursor-pointer outline-none"
            title={t('update.ready')}
            onClick={() => {
              setOpen(true);
            }}
          >
            <RefreshCw className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('update.ready')}</TooltipContent>
      </Tooltip>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('update.dialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('update.dialogDescription')}</AlertDialogDescription>
          </AlertDialogHeader>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={installing}>{t('update.later')}</AlertDialogCancel>
            <Button onClick={() => void handleInstall()} disabled={installing}>
              {installing ? t('update.restarting') : t('update.restartAndInstall')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
