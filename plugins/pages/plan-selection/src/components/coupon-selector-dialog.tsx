import { useTranslation } from 'react-i18next';
import { Ticket } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';

interface CouponSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCouponCode?: string;
  onSelect: (couponCode: string | null) => void;
}

/**
 * 优惠券选择弹窗组件（本地破限版：已移除 billing-center 依赖）
 *
 * 本地版不连接服务端优惠券系统，该弹窗始终展示「无可用优惠券」状态，
 * 保留组件签名以维持 plan-selection 页面调用契约。
 */
export function CouponSelectorDialog({
  open,
  onOpenChange,
}: CouponSelectorDialogProps) {
  const { t } = useTranslation('plans');

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      minWidth="min-w-[520px]"
      header={{
        icon: Ticket,
        iconColor: 'text-blue-500',
        title: t('couponSelector.title'),
        description: t('couponSelector.description'),
      }}
    >
      <div className="flex flex-col items-center justify-center py-10 px-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
          <Ticket className="h-8 w-8 text-blue-500/60" />
        </div>
        <h4 className="text-sm font-medium text-foreground mb-1">{t('couponSelector.noCoupons')}</h4>
        <p className="text-xs text-muted-foreground text-center max-w-[260px]">
          {t('couponSelector.noCouponsDescription')}
        </p>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onOpenChange(false)}
        >
          {t('couponSelector.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={() => onOpenChange(false)}
        >
          {t('couponSelector.confirm')}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
