export class dapCtx {
  constructor(prec) {
    this.prec = prec;
    this.base = 10n ** BigInt(this.prec);
    this.baseSq = this.base * this.base;
    this.halfBase = this.base / 2n;
    this.pow10 = new Array(prec + 1);
    this.halfPow10 = new Array(prec + 1);
    this.pow10[0] = 1n;
    this.halfPow10[0] = 0n;
    for (let i = 1; i < prec; i++) {
      this.pow10[i] = this.pow10[i - 1] * 10n;
      this.halfPow10[i] = this.pow10[i] / 2n;  // = 5n * pow10[i-1], no allocation at lookup
    }
    this.pow10[prec] = this.base;
    this.halfPow10[prec] = this.halfBase;
  }

  n(m, e) {
    if (typeof m === 'number') m = String(m);
    if (typeof m === 'string') {
      const neg = m[0] === '-';
      const s = neg ? m.slice(1) : m;
      const dot = s.indexOf('.');
      const intPart = (dot === -1 ? s : s.slice(0, dot)) || '0';
      const fracPart = dot === -1 ? '' : s.slice(dot + 1);
      // e: integer digit count for values >=1, or -(leading frac zeros) for <1
      let eVal;
      if (intPart !== '0') {
        eVal = intPart.length;
      } else {
        let z = 0;
        while (z < fracPart.length && fracPart[z] === '0') z++;
        eVal = -z;
      }
      // strip leading zeros to get the raw significant digit string
      const raw = intPart + fracPart;
      let i = 0;
      while (i < raw.length && raw[i] === '0') i++;
      if (i === raw.length) return { m: 0n, e: 0 };
      const mBig = neg ? -BigInt(raw.slice(i)) : BigInt(raw.slice(i));
      return this.n(mBig, eVal);
    }
    // BigInt path
    if (m === 0n) return { m: 0n, e };
    const neg = m < 0n;
    const abs = neg ? -m : m;
    const digits = String(abs).length;
    const diff = digits - this.prec;
    if (diff === 0) return { m, e };
    if (diff < 0) return { m: m * this.pow10[-diff], e };
    // digits > prec: truncate with rounding
    const divisor = 10n ** BigInt(diff);
    const rem = abs % divisor;
    let normalized = m / divisor;
    if (rem >= divisor / 2n) normalized += neg ? -1n : 1n;
    // overflow: e.g. 9.9999995 with prec=7 rounds to 10.000000
    const absNorm = normalized < 0n ? -normalized : normalized;
    if (absNorm >= this.base) { normalized /= 10n; e++; }
    return { m: normalized, e };
  }

  toString(a) {
    if (a.m === 0n) return '0';
    const neg = a.m < 0n;
    const abs = neg ? -a.m : a.m;
    const s = String(abs);
    const d = s.length;
    const decPt = d - this.prec + a.e; // digits before the decimal point

    let result;
    if (decPt >= d) {
      result = s + '0'.repeat(decPt - d);
    } else if (decPt > 0) {
      result = s.slice(0, decPt) + '.' + s.slice(decPt);
    } else {
      result = '0.' + '0'.repeat(-decPt) + s;
    }

    return neg ? '-' + result : result;
  }

  add(a, b) {
    // Ensure a has the larger (or equal) exponent
    if (a.e < b.e) {
      let tmp = a;
      a = b;
      b = tmp;
    }

    const shift = a.e - b.e;

    // b is more than one position below a's precision floor — contributes nothing,
    // not even a rounding carry. shift === prec is still handled below since b's
    // leading digit sits exactly at the rounding position.
    if (shift > this.prec) return a;

    // Right-shift b.m by `shift` digits to align with a
    let bAligned = b.m / this.pow10[shift];
    if (shift > 0) {
      const rem = b.m % this.pow10[shift];
      const absRem = rem < 0n ? -rem : rem;
      // Round half-away-from-zero on the dropped digits
      if (absRem >= this.halfPow10[shift]) {
        bAligned += b.m >= 0n ? 1n : -1n;
      }
    }

    let m = a.m + bAligned;
    let e = a.e;

    // Overflow: addition produced prec+1 digits — round the last one off
    if (m >= this.base || m <= -this.base) {
      const r = m % 10n;
      const absR = r < 0n ? -r : r;
      m = m / 10n + (absR >= 5n ? (m > 0n ? 1n : -1n) : 0n);
      e++;
    }

    return { m, e };
  }

  sub(a, b) {
    return this.add(a, { m: -b.m, e: b.e });
  }

  mul(a, b) {
    // a.m * 10^(a.e - prec) * b.m * 10^(b.e - prec)
    // = (a.m * b.m) * 10^(a.e + b.e - 2prec)
    // = (a.m * b.m) / 10^prec * 10^(a.e + b.e - prec)  (2prec digs in mProd)
    // = (a.m * b.m) / 10^(prec-1) * 10^(a.e + b.e - prec - 1) (2prec-1 digs in mProd)

    const mProd = a.m * b.m; // 2prec or 2prec-1 digs
    const rem = mProd % this.base; // lower prec digs, same sign as mProd
    const absRem = rem < 0n ? -rem : rem;
    let m = mProd / this.base; // prec or prec-1 digs
    const absM = m < 0n ? -m : m;
    let e = a.e + b.e; // er = ea + eb - prec + d; base assumes d=prec, else branch subtracts 1

    if (absM >= this.pow10[this.prec - 1]) {
      // mProd had 2prec digits — m already has prec digits, just round
      if (absRem >= this.halfBase) {
        m += m > 0n ? 1n : -1n;
      }
    } else {
      // mProd had 2prec-1 digits — pull one digit from rem into m
      e--;
      const remTwoDigs = absRem / this.pow10[this.prec - 2];
      m = m * 10n + (m >= 0n ? 1n : -1n) * (remTwoDigs / 10n);
      if (remTwoDigs % 10n >= 5n) {
        m += m > 0n ? 1n : -1n;
      }
    }

    // Rounding in the prec-1 branch can push m to base — normalize one more digit
    if (m >= this.base || m <= -this.base) {
      const r = m % 10n;
      const absR = r < 0n ? -r : r;
      m = m / 10n + (absR >= 5n ? (m > 0n ? 1n : -1n) : 0n);
      e++;
    }

    return { m, e };
  }
}