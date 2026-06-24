export const ITEMS_PER_PAGE = 10;

// 这里配置的是「业务路径」，由 Tauri 的 http_* 命令统一加上前缀等信息，
// 风格与 plan-selection / account-center 等页面保持一致。
export const API_ENDPOINTS = {
  STATS: 'referral/stats',
  DASHBOARD: 'referral/dashboard',
  REWARDS: 'referral/rewards',
  REFERRED_USERS: 'referral/users',
  SWITCH_LINK: 'referral/links/switch',
  REDEEM: 'referral/redeem',
} as const;
