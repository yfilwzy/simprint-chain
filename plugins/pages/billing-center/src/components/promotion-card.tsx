import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 优惠活动卡片组件
 */
export function PromotionCard() {
    const { t } = useTranslation('billing');
    const navigate = useNavigate();

    return (
        <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-4">
            {/* 背景装饰 */}
            <div className="absolute right-2 top-2 opacity-10">
                <Sparkles className="h-16 w-16 text-primary" />
            </div>

            {/* 内容 */}
            <div className="relative z-10">
                <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">{t('promotion.title')}</h4>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{t('promotion.description')}</p>
                <Button
                    size="sm"
                    variant="default"
                    className="w-full text-xs"
                    onClick={() => navigate('/plans')}
                >
                    {t('promotion.action')}
                    <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

