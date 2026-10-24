export class SessionClock {
  constructor(monotonicNow = () => performance.now()) {
    this.monotonicNow = monotonicNow;
    this.anchorUtcMs = null;
    this.anchorMonotonicMs = null;
  }

  anchor(trustedUtcMs) {
    if (!Number.isFinite(trustedUtcMs)) throw new TypeError('La hora verificada no es válida.');
    this.anchorUtcMs = trustedUtcMs;
    this.anchorMonotonicMs = this.monotonicNow();
  }

  get ready() {
    return this.anchorUtcMs !== null;
  }

  now() {
    if (!this.ready) return null;
    return this.anchorUtcMs + this.monotonicNow() - this.anchorMonotonicMs;
  }
}
