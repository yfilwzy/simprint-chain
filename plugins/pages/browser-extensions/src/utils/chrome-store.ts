/**
 * 根据扩展 ID 生成 Chrome Web Store URL
 *
 * @param extensionId - Chrome 扩展 ID
 * @returns Chrome Web Store 页面 URL
 */
export function getChromeStoreUrl(extensionId: string): string {
  return `https://chromewebstore.google.com/detail/${extensionId}`;
}

/**
 * 获取扩展的主页 URL
 * 如果扩展有 homepage，则使用 homepage；否则使用 Chrome Web Store URL
 *
 * @param extensionId - Chrome 扩展 ID
 * @param homepage - 扩展的主页 URL（可选）
 * @returns 实际的主页 URL
 */
export function getExtensionHomepageUrl(extensionId: string, homepage?: string | null): string {
  return homepage || getChromeStoreUrl(extensionId);
}
