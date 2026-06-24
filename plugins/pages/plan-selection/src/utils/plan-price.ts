import { Check, Users, Shield, Zap } from 'lucide-react';
import type { BillingPlan, PlanPriceInfo } from '../types';

/**
 * 获取功能图标
 */
export function getFeatureIcon(featureId: string) {
  if (featureId.includes('env')) return Users;
  if (featureId.includes('support')) return Shield;
  if (featureId.includes('api') || featureId.includes('rpa')) return Zap;
  return Check;
}

/**
 * 获取套餐的月度价格
 */
export function getMonthlyPrice(plan: BillingPlan): number {
  return plan.pricePerMonth;
}

/**
 * 获取套餐的原价
 */
export function getOriginalPrice(plan: BillingPlan): number {
  return plan.pricePerMonth;
}

/**
 * 获取折扣百分比
 */
export function getDiscountPercent(plan: BillingPlan): number | null {
  return plan.discount?.monthly || null;
}

/**
 * 获取实际价格（考虑折扣后）
 */
export function getActualPrice(plan: BillingPlan): number {
  if (plan.discount?.monthly) {
    return plan.pricePerMonth * (1 - plan.discount.monthly / 100);
  }
  return plan.pricePerMonth;
}

/**
 * 获取节省金额
 */
export function getSavedAmount(plan: BillingPlan): number {
  if (plan.discount?.monthly) {
    return plan.pricePerMonth - getActualPrice(plan);
  }
  return 0;
}

/**
 * 获取套餐价格信息
 */
export function getPlanPriceInfo(plan: BillingPlan): PlanPriceInfo {
  // 如果套餐有计算后的价格（来自后端），优先使用
  if (plan.calculatedPrice) {
    const cp = plan.calculatedPrice;
    const originalPrice = typeof cp.original_price === 'string' ? parseFloat(cp.original_price) : cp.original_price;
    const finalPrice = typeof cp.final_price === 'string' ? parseFloat(cp.final_price) : cp.final_price;
    const planDiscount = typeof cp.plan_discount === 'string' ? parseFloat(cp.plan_discount) : cp.plan_discount;
    const couponDiscount = typeof cp.coupon_discount === 'string' ? parseFloat(cp.coupon_discount) : cp.coupon_discount;
    const totalSaved = typeof cp.total_saved === 'string' ? parseFloat(cp.total_saved) : cp.total_saved;
    
    // 计算折扣百分比（基于套餐级折扣）
    const discountPercent = originalPrice > 0 ? (planDiscount / originalPrice) * 100 : null;
    
    return {
      monthlyPrice: finalPrice,
      originalPrice: originalPrice,
      discountPercent: discountPercent,
      actualPrice: finalPrice,
      savedAmount: totalSaved,
    };
  }
  
  // 否则使用前端计算逻辑
  return {
    monthlyPrice: getMonthlyPrice(plan),
    originalPrice: getOriginalPrice(plan),
    discountPercent: getDiscountPercent(plan),
    actualPrice: getActualPrice(plan),
    savedAmount: getSavedAmount(plan),
  };
}
