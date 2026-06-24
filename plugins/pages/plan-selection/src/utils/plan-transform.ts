import type { PlanDto, PlanFeatureDto, PlanWithFeatures } from '../api/index.types';
import type { BillingPlan, PlanFeature } from '../types';

/**
 * 将后端 PlanFeatureDto 转换为前端 PlanFeature
 */
export function transformPlanFeatureDto(dto: PlanFeatureDto): PlanFeature {
  return {
    id: dto.feature_key,
    name: dto.feature_name,
    description: dto.feature_value || undefined,
  };
}

/**
 * 将后端 PlanWithFeatures 转换为前端 BillingPlan
 */
export function transformPlanWithFeatures(pwf: PlanWithFeatures): BillingPlan {
  const dto = pwf.plan;
  return {
    id: dto.uuid,
    name: dto.name,
    pricePerMonth: Number(dto.price_per_month),
    pricePerYear: Number(dto.price_per_year),
    currency: dto.currency || 'USD',
    environmentsLimit: dto.max_environments,
    description: dto.description || '',
    features: pwf.features.map(transformPlanFeatureDto),
    popular: dto.is_recommended ?? false,
    badge: dto.is_recommended ? 'popular' : undefined,
    discount: dto.discount_monthly || dto.discount_yearly
      ? {
          monthly: dto.discount_monthly ? Number(dto.discount_monthly) : undefined,
          yearly: dto.discount_yearly ? Number(dto.discount_yearly) : undefined,
        }
      : undefined,
    calculatedPrice: pwf.calculated_price || undefined,
  };
}

