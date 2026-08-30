export type RateLimitSnapshot = {
  remaining: number | null;
  limit: number | null;
  resetEpochSec: number | null;
};

export function parseHeaderNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseResetEpochSec(raw: string | null, nowSec: number): number | null {
  const parsed = parseHeaderNumber(raw);
  if (parsed == null || parsed <= 0) return null;
  if (parsed > 1_000_000_000) return parsed;
  return nowSec + parsed;
}

export function parseRateLimitHeaders(
  getHeader: (name: string) => string | null,
  nowMs = Date.now(),
): RateLimitSnapshot {
  return {
    remaining: parseHeaderNumber(getHeader("X-RateLimit-Remaining") ?? getHeader("x-ratelimit-remaining")),
    limit: parseHeaderNumber(getHeader("X-RateLimit-Limit") ?? getHeader("x-ratelimit-limit")),
    resetEpochSec: parseResetEpochSec(
      getHeader("X-RateLimit-Reset") ?? getHeader("x-ratelimit-reset"),
      Math.floor(nowMs / 1000),
    ),
  };
}

export function retryAfterMs(
  getHeader: (name: string) => string | null,
  attempt: number,
): number {
  const parsed = parseHeaderNumber(getHeader("Retry-After") ?? getHeader("retry-after"));
  if (parsed != null && parsed > 0) {
    return Math.min(Math.max(parsed, 1), 90) * 1000;
  }
  return Math.min(1000 * 2 ** Math.max(attempt, 0), 60_000);
}

export function preRequestDelayMs(
  snapshot: RateLimitSnapshot,
  nowMs: number,
  minGapMs: number,
  lastStartedAt = 0,
): number {
  const gap = lastStartedAt > 0 ? Math.max(0, lastStartedAt + minGapMs - nowMs) : 0;
  if (snapshot.remaining == null || snapshot.limit == null || snapshot.limit <= 0) {
    return gap;
  }
  const threshold = Math.max(10, Math.ceil(snapshot.limit * 0.1));
  if (snapshot.remaining > threshold || snapshot.resetEpochSec == null) {
    return gap;
  }
  const untilReset = snapshot.resetEpochSec * 1000 - nowMs;
  return Math.max(gap, Math.min(Math.max(untilReset, minGapMs), 90_000));
}

export function keyIgnoresTeamspaceHeader(
  homeTeamspaceId: string | undefined,
  identityWithHeader: { current_teamspace_id?: string },
  probeTeamspaceId: string,
): boolean {
  if (!homeTeamspaceId || homeTeamspaceId === probeTeamspaceId) return true;
  return (identityWithHeader.current_teamspace_id ?? homeTeamspaceId) === homeTeamspaceId;
}

export class RequestPacer {
  private snapshot: RateLimitSnapshot = {
    remaining: null,
    limit: null,
    resetEpochSec: null,
  };
  private lastStartedAt = 0;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly opts: {
      minGapMs?: number;
      now?: () => number;
      sleep?: (ms: number) => Promise<void>;
    } = {},
  ) {}

  noteHeaders(getHeader: (name: string) => string | null): void {
    this.snapshot = parseRateLimitHeaders(getHeader, this.now());
  }

  async waitTurn(): Promise<void> {
    const run = this.tail.then(async () => {
      const delay = preRequestDelayMs(
        this.snapshot,
        this.now(),
        this.opts.minGapMs ?? 350,
        this.lastStartedAt,
      );
      if (delay > 0) await this.sleep(delay);
      this.lastStartedAt = this.now();
    });
    this.tail = run.catch(() => undefined);
    await run;
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return this.opts.sleep?.(ms) ?? new Promise((resolve) => setTimeout(resolve, ms));
  }
}
