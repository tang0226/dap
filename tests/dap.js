import { TestSuite } from '../assert-js/test-suite.js'
import { assertDeepEqual } from '../assert-js/assert.js'
import { dapCtx } from '../dap.js'

const ctx = new dapCtx(7);
const n = (m, e) => ({ m, e });

new TestSuite('dapCtx.add()', {
  'same exponent': () =>
    // 1.5 + 2.5 = 4.0
    assertDeepEqual(ctx.add(n(1500000n, 1), n(2500000n, 1)), n(4000000n, 1)),

  'different exponents': () =>
    // 100.0 + 5.0 = 105.0
    assertDeepEqual(ctx.add(n(1000000n, 3), n(5000000n, 1)), n(1050000n, 3)),

  'commutative (swap)': () =>
    // 5.0 + 100.0 = 105.0 — triggers the a/b swap
    assertDeepEqual(ctx.add(n(5000000n, 1), n(1000000n, 3)), n(1050000n, 3)),

  'overflow, no round': () =>
    // 9.0 + 2.0 = 11.0 — last digit of overflow is 0, no carry
    assertDeepEqual(ctx.add(n(9000000n, 1), n(2000000n, 1)), n(1100000n, 2)),

  'overflow, rounds up': () =>
    // 9.500005 + 1.0 = 10.50001 — last digit of overflow is 5, rounds up
    assertDeepEqual(ctx.add(n(9500005n, 1), n(1000000n, 1)), n(1050001n, 2)),

  'rounding during alignment': () =>
    // 100.0 + 0.5555555 = 100.5556 — dropped digits .555 round the kept digit up
    assertDeepEqual(ctx.add(n(1000000n, 3), n(5555555n, 0)), n(1005556n, 3)),

  'shift > prec, short-circuit': () =>
    // b is more than one position below a's floor — vanishes entirely
    assertDeepEqual(ctx.add(n(1234567n, 5), n(9999999n, -3)), n(1234567n, 5)),

  'shift === prec, rounds up': () =>
    // 1000000 + 0.5 = 1000001 — b's leading digit is exactly at the rounding position
    assertDeepEqual(ctx.add(n(1000000n, 7), n(5000000n, 0)), n(1000001n, 7)),

  'shift === prec, no round': () =>
    // 1000000 + 0.4999999 = 1000000 — b is below the rounding threshold
    assertDeepEqual(ctx.add(n(1000000n, 7), n(4999999n, 0)), n(1000000n, 7)),

  'subtraction via negative m': () =>
    // 5.0 + (-2.0) = 3.0
    assertDeepEqual(ctx.add(n(5000000n, 1), n(-2000000n, 1)), n(3000000n, 1)),

  'negative overflow': () =>
    // -9.0 + (-2.0) = -11.0
    assertDeepEqual(ctx.add(n(-9000000n, 1), n(-2000000n, 1)), n(-1100000n, 2)),

  'cancellation (result < prec digits in m)': () =>
    // 100.0 + (-99.9) = 0.1 — result m=1000 has only 4 digits, e unchanged
    assertDeepEqual(ctx.add(n(1000000n, 3), n(-9990000n, 2)), n(1000n, 3)),

  'zero operand': () =>
    // 0 + 5.0 = 5.0
    assertDeepEqual(ctx.add(n(0n, 0), n(5000000n, 1)), n(5000000n, 1)),

  'exact cancellation yields non-canonical zero': () =>
    // 5.0 + (-5.0) = 0, but e is inherited from a rather than reset to 0
    assertDeepEqual(ctx.add(n(5000000n, 1), n(-5000000n, 1)), n(0n, 1)),

}).runTests();

new TestSuite('dapCtx.sub()', {
  'basic': () =>
    // 5.0 - 2.0 = 3.0
    assertDeepEqual(ctx.sub(n(5000000n, 1), n(2000000n, 1)), n(3000000n, 1)),

  'negative result': () =>
    // 2.0 - 5.0 = -3.0
    assertDeepEqual(ctx.sub(n(2000000n, 1), n(5000000n, 1)), n(-3000000n, 1)),

  'different exponents': () =>
    // 105.0 - 5.0 = 100.0
    assertDeepEqual(ctx.sub(n(1050000n, 3), n(5000000n, 1)), n(1000000n, 3)),

  'subtract zero': () =>
    assertDeepEqual(ctx.sub(n(1234567n, 2), n(0n, 0)), n(1234567n, 2)),

}).runTests();

const ctx3 = new dapCtx(3);

new TestSuite('dapCtx.mul()', {
  // --- prec-1 branch: mProd has 2*prec-1 = 13 digits ---

  'prec-1, no round': () =>
    // 2.0 × 3.0 = 6.0 — rem=0, nothing to round
    assertDeepEqual(ctx.mul(n(2000000n, 1), n(3000000n, 1)), n(6000000n, 1)),

  'prec-1, digit extraction, no round': () =>
    // 12.34567 × 10.00001 = 123.4568 — pulls digit 8 from rem, second digit 2 < 5
    assertDeepEqual(ctx.mul(n(1234567n, 2), n(1000001n, 2)), n(1234568n, 3)),

  'prec-1, rounds up': () =>
    // pi × e ≈ 8.539736 — pulls digit 5 from rem, second digit 7 rounds up
    assertDeepEqual(ctx.mul(n(3141593n, 1), n(2718282n, 1)), n(8539736n, 1)),

  'prec-1, different exponents': () =>
    // 200.0 × 30.0 = 6000.0
    assertDeepEqual(ctx.mul(n(2000000n, 3), n(3000000n, 2)), n(6000000n, 4)),

  'prec-1, identity': () =>
    // 12.34567 × 1.0 = 12.34567
    assertDeepEqual(ctx.mul(n(1234567n, 2), n(1000000n, 1)), n(1234567n, 2)),

  // --- prec branch: mProd has 2*prec = 14 digits ---

  'prec, no round': () =>
    // 99.99999² ≈ 9999.998 — rem=1, well below halfBase
    assertDeepEqual(ctx.mul(n(9999999n, 2), n(9999999n, 2)), n(9999998n, 4)),

  'prec, rounds up': () =>
    // 90.00001 × 5.556000 ≈ 500.0401 — rem=5556000 >= halfBase=5000000
    assertDeepEqual(ctx.mul(n(9000001n, 2), n(5556000n, 1)), n(5000401n, 3)),

  // --- signs ---

  'negative × positive': () =>
    // -3.0 × 2.0 = -6.0
    assertDeepEqual(ctx.mul(n(-3000000n, 1), n(2000000n, 1)), n(-6000000n, 1)),

  'negative × negative': () =>
    // -2.0 × -3.0 = 6.0
    assertDeepEqual(ctx.mul(n(-2000000n, 1), n(-3000000n, 1)), n(6000000n, 1)),

  'prec, negative rounds up': () =>
    // -90.00001 × 5.556 ≈ -500.0401 — same magnitudes as positive case
    assertDeepEqual(ctx.mul(n(-9000001n, 2), n(5556000n, 1)), n(-5000401n, 3)),

  // --- overflow handler (prec-1 branch rounds m up to base) ---
  // Requires prec=3 where reachable: 10.1 × 990 = 9999 → rounds to 10000
  // mProd=99990, m_initial=99, rem=990; pulls digit 9, second digit 9 rounds
  // 999 → 1000 = base → overflow handler fires → m=100, e++

  'prec-1 overflow handler (prec=3)': () =>
    assertDeepEqual(ctx3.mul(n(101n, 2), n(990n, 3)), n(100n, 5)),

}).runTests();
