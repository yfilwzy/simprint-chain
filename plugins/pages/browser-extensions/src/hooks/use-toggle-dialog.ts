import { useState, useCallback } from 'react';
import type { ExtensionItem } from '../types';

export function useToggleDialog() {
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [togglingExt, setTogglingExt] = useState<ExtensionItem | null>(null);
  const [toggleAction, setToggleAction] = useState<'disable' | 'enable'>('disable');

  const openToggleDialog = useCallback((extension: ExtensionItem, action: 'disable' | 'enable') => {
    setTogglingExt(extension);
    setToggleAction(action);
    setToggleDialogOpen(true);
  }, []);

  const closeToggleDialog = useCallback(() => {
    setToggleDialogOpen(false);
    setTogglingExt(null);
  }, []);

  return {
    toggleDialogOpen,
    togglingExt,
    toggleAction,
    openToggleDialog,
    closeToggleDialog,
  };
}
