import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ReferralStats, RedeemType } from '../types';

interface RedeemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: ReferralStats | null;
  redeemPoints: string;
  redeemType: RedeemType;
  onRedeemPointsChange: (points: string) => void;
  onRedeemTypeChange: (type: RedeemType) => void;
  onConfirm: () => void;
}

export const RedeemDialog: React.FC<RedeemDialogProps> = ({
  open,
  onOpenChange,
  stats,
  redeemPoints,
  redeemType,
  onRedeemPointsChange,
  onRedeemTypeChange,
  onConfirm,
}) => {
  const { t } = useTranslation('referral');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{t('redeem.title')}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('redeem.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="redeem-points" className="text-xs">
              {t('redeem.points')}
            </Label>
            <Input
              id="redeem-points"
              type="number"
              value={redeemPoints}
              onChange={(e) => onRedeemPointsChange(e.target.value)}
              placeholder="输入兑换点数"
              className="text-xs"
            />
            <div className="text-[10px] text-muted-foreground">
              可用点数: {stats?.availablePoints ?? 0}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="redeem-type" className="text-xs">
              {t('redeem.type')}
            </Label>
            <Select value={redeemType} onValueChange={(v) => onRedeemTypeChange(v as RedeemType)}>
              <SelectTrigger id="redeem-type" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quota">{t('redeem.types.quota')}</SelectItem>
                <SelectItem value="feature">{t('redeem.types.feature')}</SelectItem>
                <SelectItem value="duration">{t('redeem.types.duration')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button size="sm" className="text-xs" onClick={onConfirm}>
            确认兑换
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
