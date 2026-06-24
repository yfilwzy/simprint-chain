import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ReferralStats, RedeemType } from '../types';
import { switchReferralLink, redeemReferralPoints } from '../api';

export interface UseReferralHandlersParams {
  stats: ReferralStats | null;
  /**
   * 统计数据更新回调。
   * 在新的实现中，由上层负责重新拉取 Dashboard，因此不再直接传递 stats。
   */
  onStatsUpdate: () => void;
}

export interface UseReferralHandlersReturn {
  // 兑换对话框
  redeemDialogOpen: boolean;
  setRedeemDialogOpen: (open: boolean) => void;
  redeemPoints: string;
  setRedeemPoints: (points: string) => void;
  redeemType: RedeemType;
  setRedeemType: (type: RedeemType) => void;

  // 事件处理
  handleSwitchLink: (linkId: string) => Promise<void>;
  handleCopy: (text: string, label: string) => Promise<void>;
  handleRedeem: () => Promise<void>;
}

export function useReferralHandlers(params: UseReferralHandlersParams): UseReferralHandlersReturn {
  const { stats, onStatsUpdate } = params;
  const { t } = useTranslation('referral');

  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [redeemType, setRedeemType] = useState<RedeemType>('quota');

  const handleSwitchLink = useCallback(
    async (linkId: string) => {
      try {
        await switchReferralLink({ link_uuid: linkId });
        // 切换成功后由上层触发 Dashboard 刷新
        onStatsUpdate();
      } catch {
        toast.error('切换推广链接失败');
      }
    },
    [onStatsUpdate]
  );

  const handleCopy = useCallback(async (text: string, label: string) => {
    if (!text) {
      toast.error('复制失败：链接为空');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 兼容性回退：使用隐藏 textarea + execCommand
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (!ok) {
          throw new Error('execCommand copy failed');
        }
      }

      toast.success(`已复制${label}`);
    } catch (e) {
      // 控制台打印错误原因，方便排查
      // eslint-disable-next-line no-console
      console.error('Copy referral link failed:', e);
      toast.error('复制失败');
    }
  }, []);

  const handleRedeem = useCallback(async () => {
    const points = parseInt(redeemPoints, 10);
    if (!points || points <= 0) {
      toast.warning('请输入有效的点数');
      return;
    }
    if (!stats || stats.availablePoints < points) {
      toast.warning(t('redeem.insufficientPoints'));
      return;
    }
    try {
      await redeemReferralPoints({ points, type: redeemType });
      toast.success(t('redeem.success'));
      setRedeemDialogOpen(false);
      setRedeemPoints('');
      // 成功后交给上层刷新 Dashboard / 统计
      onStatsUpdate();
    } catch {
      toast.error(t('redeem.error'));
    }
  }, [redeemPoints, redeemType, stats, t, onStatsUpdate]);

  return {
    redeemDialogOpen,
    setRedeemDialogOpen,
    redeemPoints,
    setRedeemPoints,
    redeemType,
    setRedeemType,
    handleSwitchLink,
    handleCopy,
    handleRedeem,
  };
}
