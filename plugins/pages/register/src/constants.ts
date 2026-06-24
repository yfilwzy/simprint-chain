/**
 * 邮箱验证正则
 * - 用户名部分：允许大小写字母、数字、点、连字符、下划线
 * - 域名部分：只允许小写字母、数字、连字符
 */
export const EMAIL_REGEX =
  /^[^\s@]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const MIN_PASSWORD_LENGTH = 8;

export const CODE_COUNTDOWN_SECONDS = 60;

export const CODE_MAX_LENGTH = 6;
