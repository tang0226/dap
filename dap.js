class dapCtx {
  constructor(prec) {
    this.prec = prec;
    this.base = 10n ** BigInt(this.prec);
    this.baseSq = this.base * this.base;
    this.pow10 = new Array(prec + 1)
    this.pow10[0] = 1n
    for (let i = 1; i < prec; i++) {
      this.pow10[i] = this.pow10[i - 1] * 10n  // multiply by single digit each step
    }
    this.pow10[prec] = this.base;
  }

  // value = m * 10^(e - prec)
  add(a, b) {
    // Ensure a has the larger (or equal) exponent
    if (a.e < b.e) {
      let tmp = a;
      a = b;
      b = tmp;
    }

    const shift = a.e - b.e

    // b is more than one position below a's precision floor — contributes nothing,
    // not even a rounding carry. shift === prec is still handled below since b's
    // leading digit sits exactly at the rounding position.
    if (shift > this.prec) return a

    // Right-shift b.m by `shift` digits to align with a
    let bAligned = b.m / this.pow10[shift]
    if (shift > 0) {
      const rem = b.m % this.pow10[shift]
      const absRem = rem < 0n ? -rem : rem
      // Round half-away-from-zero on the dropped digits
      if (absRem * 2n >= this.pow10[shift])
        bAligned += b.m >= 0n ? 1n : -1n
    }

    let m = a.m + bAligned
    let e = a.e

    // Overflow: addition produced prec+1 digits — round the last one off
    if (m >= this.base || m <= -this.base) {
      const r = m % 10n
      const absR = r < 0n ? -r : r
      m = m / 10n + (absR >= 5n ? (m > 0n ? 1n : -1n) : 0n)
      e++
    }

    return { m, e }
  }

}