import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Smartphone, Wallet, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export type RechargeMethod = 'alipay' | 'wechat';

interface RechargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onSuccess: () => void;
}

/**
 * 充值弹窗组件
 */
export function RechargeDialog({ open, onOpenChange, amount, onSuccess }: RechargeDialogProps) {
  const { t } = useTranslation('plans');
  const [rechargeMethod, setRechargeMethod] = useState<RechargeMethod>('alipay');
  const [processing, setProcessing] = useState(false);

  const handleRecharge = async () => {
    setProcessing(true);
    try {
      // TODO: 对接支付接口
      // 当前为开发阶段，直接模拟充值成功
      // 实际实现时需要：
      // 1. 调用后端创建充值订单接口
      // 2. 根据支付方式跳转到对应的支付页面（支付宝/微信）
      // 3. 处理支付回调
      // 4. 更新钱包余额

      // 模拟支付成功
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(t('recharge.success', { amount: amount.toFixed(2) }));
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(t('recharge.error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <FormattedDialog
      open={open}
      onOpenChange={onOpenChange}
      header={{
        icon: Wallet,
        title: t('recharge.title'),
        description: t('recharge.description'),
      }}
      minWidth="min-w-[520px]"
    >
      <div className="space-y-6">
        {/* 充值金额 */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground">{t('recharge.amount')}</h3>
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">${amount.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">{t('recharge.amountDescription')}</div>
            </div>
          </div>
        </div>

        {/* 支付方式选择 */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground">{t('recharge.paymentMethod')}</h3>
          <RadioGroup
            value={rechargeMethod}
            onValueChange={(value) => setRechargeMethod(value as RechargeMethod)}
          >
            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="alipay" id="recharge-alipay" />
              <Label htmlFor="recharge-alipay" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-xs">{t('recharge.alipay')}</span>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="wechat" id="recharge-wechat" />
              <Label htmlFor="recharge-wechat" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <span className="text-xs">{t('recharge.wechat')}</span>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* 描述信息 */}
        <div className="rounded-lg border p-3 bg-muted/30">
          <div className="flex items-start gap-2">
            <Wallet className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              {t('recharge.info')}
            </div>
          </div>
        </div>
      </div>

      <FormattedDialogFooter>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onOpenChange(false)}
          disabled={processing}
        >
          {t('recharge.cancel')}
        </Button>
        <Button
          size="sm"
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={handleRecharge}
          disabled={processing}
        >
          {processing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('recharge.processing')}
            </>
          ) : (
            t('recharge.confirm')
          )}
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}

