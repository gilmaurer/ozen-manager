const DELAYS_MS = [1_000, 3_000, 10_000, 30_000];

function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  if (typeof e === "object" && e !== null) {
    const err = e as { message?: string; name?: string };
    const msg = (err.message ?? "").toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("timed out") ||
      msg.includes("enetunreach") ||
      msg.includes("dns")
    ) {
      return true;
    }
    if (err.name === "TypeError" && msg.includes("fetch")) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    try {
      return await op();
    } catch (e) {
      lastErr = e;
      if (!isNetworkError(e)) throw e;
      if (attempt === DELAYS_MS.length) break;
      await sleep(DELAYS_MS[attempt]);
    }
  }
  throw lastErr;
}
