// 北京时区（Asia/Shanghai, UTC+8）的本月 / 本周起始 unix ms。
// 不依赖服务器本地时区——把现在的 unix ms 加 8h 偏移得到 UTC 字段 = 北京真实日期，
// 再用那个日期的年/月/(日 - 周内偏移) 反算回 unix ms。
const SHANGHAI_OFFSET_MS = 8 * 3600 * 1000;

/** 北京时间本月 1 号 00:00 的 unix ms */
export function startOfMonthCN(now: number = Date.now()): number {
  const cn = new Date(now + SHANGHAI_OFFSET_MS);
  return Date.UTC(cn.getUTCFullYear(), cn.getUTCMonth(), 1) - SHANGHAI_OFFSET_MS;
}

/** 北京时间本周一 00:00 的 unix ms（ISO 8601 周一为始） */
export function startOfWeekCN(now: number = Date.now()): number {
  const cn = new Date(now + SHANGHAI_OFFSET_MS);
  const dow = cn.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  return Date.UTC(cn.getUTCFullYear(), cn.getUTCMonth(), cn.getUTCDate() - back) - SHANGHAI_OFFSET_MS;
}
