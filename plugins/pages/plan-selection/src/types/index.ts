export interface PlanFeature {
  id: string;
  name: string;
  description?: string;
}

export interface CalculatedPriceInfo {
  original_price: number | string;
  plan_discount: number | string;
  coupon_discount: number | string;
  final_price: number | string;
  total_saved: number | string;
  billing_period: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  pricePerMonth: number;
  pricePerYear?: number;
  currency: string;
  environmentsLimit: number;
  description: string;
  features: PlanFeature[];
  discount?: {
    monthly?: number;
    yearly?: number;
  };
  popular?: boolean;
  badge?: string;
  calculatedPrice?: CalculatedPriceInfo | null;
}

export interface CurrentPlan {
  id: string;
  expiresAt?: string;
  environmentsUsed: number;
  maxEnvironments: number;
}

export interface ReferralPlanSummaryView {
  referralValueLast30Days: number;
  currentPlanMonthlyPrice?: number | null;
  coverageRatio?: number | null;
}

export interface PlanPriceInfo {
  monthlyPrice: number;
  originalPrice: number;
  discountPercent: number | null;
  actualPrice: number;
  savedAmount: number;
}
