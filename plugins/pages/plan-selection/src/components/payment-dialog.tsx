import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, CreditCard, Smartphone, Loader2 } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { BillingPlan, PlanPriceInfo } from '../types';
import { getWallet } from '../api';

export type PaymentMethod = 'wallet' | 'alipay' | 'wechat';

interface PaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan: BillingPlan;
    priceInfo: PlanPriceInfo;
    couponCode?: string;
    onPayment: (method: PaymentMethod) => void;
    onRecharge: (amount: number) => void;
}

/**
 * 支付弹窗组件
 */
export function PaymentDialog({
    open,
    onOpenChange,
    plan,
    priceInfo,
    couponCode,
    onPayment,
    onRecharge,
}: PaymentDialogProps) {
    const { t } = useTranslation('plans');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    // 获取钱包余额
    useEffect(() => {
        if (open) {
            setLoading(true);
            getWallet()
                .then((wallet) => {
                    setWalletBalance(Number(wallet.balance) || 0);
                })
                .catch(() => {
                    setWalletBalance(0);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open]);

    const amount = priceInfo.actualPrice;
    const isBalanceSufficient = walletBalance >= amount;
    const insufficientAmount = isBalanceSufficient ? 0 : amount - walletBalance;

    const handlePayment = () => {
        if (paymentMethod === 'wallet' && !isBalanceSufficient) {
            // 余额不足，显示充值弹窗
            onRecharge(insufficientAmount);
            onOpenChange(false);
        } else {
            // 直接支付
            onPayment(paymentMethod);
            onOpenChange(false);
        }
    };

    return (
        <FormattedDialog
            open={open}
            onOpenChange={onOpenChange}
            header={{
                icon: Wallet,
                title: t('payment.title'),
                description: t('payment.description'),
            }}
            minWidth="min-w-[520px]"
        >
            <div className="space-y-6">
                {/* 消费详情 */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-foreground">{t('payment.orderDetails')}</h3>
                    <div className="space-y-2 rounded-lg border p-3 bg-muted/50">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-xs text-muted-foreground">{t('payment.planName')}</span>
                            <span className="text-xs font-medium">{plan.name}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-xs text-muted-foreground">{t('payment.subscriptionDuration')}</span>
                            <span className="text-xs font-medium">{t('right.durationValue')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-xs text-muted-foreground">{t('payment.amount')}</span>
                            <span className="text-base font-bold text-primary">${amount.toFixed(2)}</span>
                        </div>
                        {couponCode && (
                            <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                                <span className="text-xs text-muted-foreground">{t('payment.coupon')}</span>
                                <span className="text-xs font-medium text-primary">{couponCode}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 支付方式选择 */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-foreground">{t('payment.paymentMethod')}</h3>
                    <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                        <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="wallet" id="wallet" />
                            <Label htmlFor="wallet" className="flex-1 cursor-pointer">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Wallet className="h-4 w-4" />
                                        <span className="text-xs">{t('payment.wallet')}</span>
                                    </div>
                                    {loading ? (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            {t('payment.loading')}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            {t('payment.balance')}: ${walletBalance.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                {paymentMethod === 'wallet' && !isBalanceSufficient && (
                                    <div className="mt-1 text-xs text-destructive">
                                        {t('payment.insufficientBalance', { amount: insufficientAmount.toFixed(2) })}
                                    </div>
                                )}
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="alipay" id="alipay" />
                            <Label htmlFor="alipay" className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    <span className="text-xs">{t('payment.alipay')}</span>
                                </div>
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                            <RadioGroupItem value="wechat" id="wechat" />
                            <Label htmlFor="wechat" className="flex-1 cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <Smartphone className="h-4 w-4" />
                                    <span className="text-xs">{t('payment.wechat')}</span>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
            </div>

            <FormattedDialogFooter>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
                    {t('payment.cancel')}
                </Button>
                <Button
                    size="sm"
                    className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                    onClick={handlePayment}
                >
                    {paymentMethod === 'wallet' && !isBalanceSufficient
                        ? t('payment.recharge')
                        : t('payment.confirm')}
                </Button>
            </FormattedDialogFooter>
        </FormattedDialog>
    );
}

