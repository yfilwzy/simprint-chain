/**
 * 重置密码步骤
 */
export type ResetStep = 1 | 2;

/**
 * 重置密码表单数据
 */
export interface ResetFormData {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}
