/**
 * Adaptif throttling: token bucket + 429/4 ailesi hatalarında exponential backoff. Limitler
 * doğrulanmadığı için sabit sayı kullanılmaz; başarılı çağrılarda hız yavaşça artar (AIMD).
 * ("200 × engaged users/saat" formülü KULLANILMAZ.)
 */
export class AdaptiveThrottle {
  private tokens: number;
  private rate: number;
  private last: number;
  private backoffUntil = 0;
  private failures = 0;

  constructor(
    initialRatePerSec = 5,
    private readonly minRate = 0.2,
    private readonly maxRate = 1000,
    private readonly now: () => number = Date.now,
  ) {
    this.rate = initialRatePerSec;
    this.tokens = initialRatePerSec;
    this.last = now();
  }

  get currentRate(): number {
    return this.rate;
  }

  /** Bekleme süresi (ms); 0 ise hemen gönderilebilir ve bir token tüketilir. */
  acquire(): number {
    const t = this.now();
    if (t < this.backoffUntil) return this.backoffUntil - t;
    this.tokens = Math.min(this.rate, this.tokens + ((t - this.last) / 1000) * this.rate);
    this.last = t;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }
    return Math.ceil(((1 - this.tokens) / this.rate) * 1000);
  }

  onSuccess(): void {
    this.failures = 0;
    this.rate = Math.min(this.maxRate, this.rate + 0.1);
  }

  onRateLimited(retryAfterMs?: number): void {
    this.failures++;
    this.rate = Math.max(this.minRate, this.rate / 2);
    const backoff = retryAfterMs ?? Math.min(60_000, 500 * 2 ** (this.failures - 1));
    this.backoffUntil = this.now() + backoff;
  }
}
