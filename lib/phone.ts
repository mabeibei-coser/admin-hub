// SHARED: 同时存在于 career-report/lib/phone.ts —— 改一边记得改另一边。
// 没有走 _shared/ 是为了让每个 repo 自己拥有自己的代码（owner: admin-hub + career-report 双拥有）。

/** 大陆手机号校验（11 位，1[3-9] 开头）。仅做格式校验，不查号段归属。 */
export function isValidCnMobile(s: string): boolean {
  return /^1[3-9]\d{9}$/.test(s);
}
