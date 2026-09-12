/**
 * 弱网下的 GET 重试。
 *
 * 公网经 Cloudflare quick tunnel 访问时实测约 25% 的请求会 SSL EOF /
 * 握手超时（本地直连 0%），所以列表类 GET 不能一次失败就当空结果——
 * 那会让「我的作品」偶发显示空白。这里失败重试 3 次。
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJsonRetry<T>(url: string, tries = 3): Promise<T | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt > 0) await sleep(600 * attempt);
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return (await res.json()) as T;
    } catch {
      /* 网络失败 → 重试 */
    }
  }
  return null;
}
