import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import {
  Copy,
  Users,
  MousePointerClick,
  DollarSign,
  Clock,
  CheckCircle2,
  Lock,
  Radio,
} from 'lucide-react';
import { RedeemableRewardCard } from './redeemable-reward-card';
import type { ReferralStats, ReferralLink } from '../types';

interface OverviewTabProps {
  stats: ReferralStats;
  currentLink: ReferralLink | null;
  onRedeem: () => void;
  onSwitchLink: (linkId: string) => Promise<void>;
  onCopy: (text: string, label: string) => Promise<void>;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  currentLink,
  onRedeem,
  onSwitchLink,
  onCopy,
}) => {
  const { t } = useTranslation('referral');

  // 根据链接ID确定解锁条件（由后端配置的 description 驱动）
  const getUnlockCondition = (linkId: string): string => {
    const link = stats.links.find((l) => l.id === linkId);
    if (link?.description) {
      return link.description;
    }
    // 默认回退为通用文案，由 i18n 自行决定内容
    return t('overview.defaultUnlockCondition');
  };

  // 统计数据配置
  const statsData = useMemo(() => {
    const maxValue = Math.max(
      stats.linkClicks,
      stats.registeredUsers,
      stats.last30DaysConsumption,
      stats.pendingPoints,
      1 // 避免除零
    );

    return [
      {
        label: t('overview.stats.linkClicks'),
        value: stats.linkClicks,
        icon: MousePointerClick,
        color: 'bg-primary',
      },
      {
        label: t('overview.stats.registeredUsers'),
        value: stats.registeredUsers,
        icon: Users,
        color: 'bg-primary',
      },
      {
        label: t('overview.stats.last30DaysConsumption'),
        value: stats.last30DaysConsumption,
        icon: DollarSign,
        color: 'bg-primary',
        format: (v: number) => `$${v.toFixed(2)}`,
      },
      {
        label: t('overview.stats.underReview'),
        value: stats.pendingPoints,
        icon: Clock,
        color: 'bg-primary',
      },
    ].map((item) => {
      const heightPercent = Math.max((item.value / maxValue) * 100, 0);
      const barHeight = Math.max(heightPercent, 2);
      const valueBottom = barHeight;
      return { ...item, barHeight, valueBottom };
    });
  }, [stats, t]);

  return (
    <div className="flex-1">
      <div className="p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* 顶部：可兑换奖励 + 统计卡片 + 奖励规则 */}
          <div className="grid grid-cols-3 gap-4">
            {/* 可兑换奖励 - 占据两行，带Canvas背景和图标背景 */}
            <RedeemableRewardCard
              availablePoints={stats.availablePoints}
              pendingPoints={stats.pendingPoints}
              onRedeem={onRedeem}
            />

            {/* 统计卡片 - 链接点击 */}
            <div className="bg-background border border-border p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">
                  {t('overview.stats.linkClicks')}
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.linkClicks}</div>
            </div>

            {/* 充值用户和名下用户（两个独立卡片） */}
            <div className="bg-background p-0">
              <div className="flex gap-3">
                {/* 充值用户 */}
                <div className="flex-1 bg-background border border-border p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">
                      {t('overview.stats.paidUsers')}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stats.paidUsers}</div>
                </div>

                {/* 名下用户 */}
                <div className="flex-1 bg-background border border-border p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">
                      {t('overview.stats.registeredUsers')}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stats.registeredUsers}</div>
                </div>
              </div>
            </div>

            {/* 总获得奖励 */}
            <div className="border border-border p-4 bg-primary/5">
              <div className="text-xs text-muted-foreground mb-2">
                {t('overview.stats.totalEarned')}
              </div>
              <div className="text-2xl font-bold text-primary">{stats.totalEarnedPoints}</div>
            </div>

            {/* 奖励规则卡片（末尾，上下布局） */}
            {currentLink && (
              <div className="bg-background border border-border p-4">
                <div className="text-xs text-muted-foreground mb-3">
                  {t('overview.rewardRules')}
                </div>
                <div className="space-y-2.5">
                  <div className="bg-primary/5 border border-primary/20 rounded p-2.5">
                    <div className="text-xs text-muted-foreground mb-1">
                      {t('overview.youWillGet')}
                    </div>
                    <div className="text-xl font-bold text-primary">{currentLink.rewardRate}%</div>
                  </div>
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded p-2.5">
                    <div className="text-xs text-muted-foreground mb-1">
                      {t('overview.theyWillGet')}
                    </div>
                    <div className="text-xl font-bold text-orange-500">
                      {currentLink.discountRate}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 主要内容区域：左侧推广链接选择，右侧详情 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 左侧：推广链接选择（田字布局） */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('overview.selectLink')}</h3>
              <div className="grid grid-cols-2 gap-3">
                {stats.links.map((link, index) => {
                  const isSelected = link.id === stats.currentLinkId;
                  const linkDisplayName =
                    link.name || t('overview.linkFallback', { index: index + 1 });
                  return (
                    <div
                      key={link.id}
                      className={`bg-background border rounded-lg p-4 cursor-pointer transition-all h-28 flex flex-col relative ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : link.unlocked
                            ? 'border-border hover:border-primary/50'
                            : 'border-border opacity-60 cursor-not-allowed'
                      }`}
                      onClick={() => {
                        if (link.unlocked && !isSelected) {
                          void onSwitchLink(link.id);
                        }
                      }}
                    >
                      {/* 复制按钮（右上角） */}
                      {link.unlocked && (
                        <button
                          className="absolute top-2 right-2 p-1.5 hover:bg-muted rounded transition-colors z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onCopy(link.url, t('overview.copyLink'));
                          }}
                          title={t('overview.copyLink')}
                        >
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}

                      <div className="flex items-center justify-between mb-auto">
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <Radio className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-border" />
                          )}
                          <span className="text-sm font-semibold text-foreground">
                            {linkDisplayName}
                          </span>
                        </div>
                        {!link.unlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      {!link.unlocked && (
                        <div className="text-xs text-muted-foreground mt-auto">
                          {getUnlockCondition(link.id)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 右侧：数据统计（垂直柱状图） */}
            <div className="bg-background border border-border p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">{t('overview.dataStats')}</h3>
              <div className="flex items-end justify-between gap-3 h-56 pt-10">
                {statsData.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center gap-2 h-full max-w-[80px]"
                    >
                      {/* 垂直柱子容器 */}
                      <div className="flex-1 w-full flex flex-col items-center justify-end relative min-h-0">
                        {/* 数值显示 - 在柱子顶部 */}
                        <div
                          className="text-xs font-bold text-foreground absolute whitespace-nowrap"
                          style={{
                            bottom: `${item.valueBottom}%`,
                            transform: 'translateY(-100%)',
                            marginBottom: '12px',
                          }}
                        >
                          {item.format ? item.format(item.value) : item.value}
                        </div>

                        {/* 垂直柱子 */}
                        <div className="w-full flex items-end flex-1 min-h-0">
                          <div
                            className={`w-full max-w-[40px] mx-auto ${item.color} rounded-t transition-all`}
                            style={{ height: `${item.barHeight}%` }}
                          />
                        </div>
                      </div>

                      {/* 标签 */}
                      <div className="flex items-center gap-1">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">
                          {item.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
