import { TestSuite } from '../assert-js/test-suite.js'
import { assertDeepEqual, assertEqual, assertThrows } from '../assert-js/assert.js'
import { DapContext } from '../dap-context.js'

const ctx = new DapContext(7);
const n = (m, e) => ({ m, e });

// Check all but the last digit — 1–2 ULP error is expected for transcendental results.
function assertApprox(actual, expected) {
  const prefix = expected.slice(0, -1);
  assertEqual(actual.startsWith(prefix), true,
    `Expected "${actual}" to approximate "${expected}" (prefix "${prefix}")`);
}

new TestSuite('DapContext.n()', {
  'zero': () => {
    assertDeepEqual(ctx.n(0n, 5), n(0n, 5));
  },

  'already prec digits': () => {
    assertDeepEqual(ctx.n(1234567n, 3), n(1234567n, 3));
  },

  'pad zeros (1 digit)': () => {
    assertDeepEqual(ctx.n(1n, 2), n(1000000n, 2));
  },

  'pad zeros (partial)': () => {
    // 123 → 1230000 (4 zeros appended)
    assertDeepEqual(ctx.n(123n, 4), n(1230000n, 4));
  },

  'truncate, no round': () => {
    // 12345674 → drop last digit 4 (<5), no carry
    assertDeepEqual(ctx.n(12345674n, 3), n(1234567n, 3));
  },

  'truncate, rounds up (digit = 5)': () => {
    // 12345675 → drop last digit 5 (=5, round up)
    assertDeepEqual(ctx.n(12345675n, 3), n(1234568n, 3));
  },

  'truncate, rounds up (digit > 5)': () => {
    assertDeepEqual(ctx.n(12345679n, 3), n(1234568n, 3));
  },

  'truncate multiple digits': () => {
    // 123456789 → drop last 2 digits (89 >= 50, round up)
    assertDeepEqual(ctx.n(123456789n, 5), n(1234568n, 5));
  },

  'rounding overflow': () => {
    // 99999995 → rounds up to 10000000 = base → e increments
    assertDeepEqual(ctx.n(99999995n, 2), n(1000000n, 3));
  },

  'negative, pad zeros': () => {
    assertDeepEqual(ctx.n(-5n, 1), n(-5000000n, 1));
  },

  'negative, truncate rounds up': () => {
    // half-away-from-zero: -12345675 → -1234568
    assertDeepEqual(ctx.n(-12345675n, 3), n(-1234568n, 3));
  },

  'negative, rounding overflow': () => {
    assertDeepEqual(ctx.n(-99999995n, 2), n(-1000000n, 3));
  },

  // --- string inputs ---

  'string: integer': () => {
    // "100" → e=3, pads to 1000000
    assertDeepEqual(ctx.n('100'), n(1000000n, 3));
  },

  'string: decimal, fewer digits than prec': () => {
    // "3.14" → pads to 3140000
    assertDeepEqual(ctx.n('3.14'), n(3140000n, 1));
  },

  'string: decimal, exact prec digits': () => {
    assertDeepEqual(ctx.n('1234.567'), n(1234567n, 4));
  },

  'string: decimal, more digits than prec (rounds)': () => {
    // π to 10 digits → rounds to 7
    assertDeepEqual(ctx.n('3.1415926535'), n(3141593n, 1));
  },

  'string: pure fraction (e === 0)': () => {
    assertDeepEqual(ctx.n('0.5'), n(5000000n, 0));
  },

  'string: leading fractional zeros (e < 0)': () => {
    // "0.001" → z=2 leading zeros → e=-2
    assertDeepEqual(ctx.n('0.001'), n(1000000n, -2));
  },

  'string: zero': () => {
    assertDeepEqual(ctx.n('0'), n(0n, 0));
  },

  'string: negative': () => {
    assertDeepEqual(ctx.n('-42.5'), n(-4250000n, 2));
  },

  'string: rounding overflow': () => {
    // 9.9999995 rounds up to 10.000000 — e increments
    assertDeepEqual(ctx.n('9.9999995'), n(1000000n, 2));
  },

  // --- number inputs ---

  'number: integer': () => {
    assertDeepEqual(ctx.n(100), n(1000000n, 3));
  },

  'number: float': () => {
    assertDeepEqual(ctx.n(3.14), n(3140000n, 1));
  },

  'number: zero': () => {
    assertDeepEqual(ctx.n(0), n(0n, 0));
  },

  'number: negative float': () => {
    assertDeepEqual(ctx.n(-42.5), n(-4250000n, 2));
  },

}).runTests();

new TestSuite('DapContext.toString()', {
  'zero': () => {
    assertDeepEqual(ctx.toString(ctx.n(0n, 0)), '0');
  },

  'integer (e === prec)': () => {
    // 1234567 — decPt == d, no decimal point or trailing zeros
    assertDeepEqual(ctx.toString(ctx.n(1234567n, 7)), '1234567');
  },

  'integer, trailing zeros (e > prec)': () => {
    // 12345670 — decPt > d, one trailing zero
    assertDeepEqual(ctx.toString(ctx.n(1234567n, 8)), '12345670');
  },

  'decimal point in middle': () => {
    assertDeepEqual(ctx.toString(ctx.n(1234567n, 4)), '1234.567');
  },

  'one integer digit (e === 1)': () => {
    assertDeepEqual(ctx.toString(ctx.n(1234567n, 1)), '1.234567');
  },

  'pure fraction (e === 0)': () => {
    // decPt = 0 — all digits are fractional
    assertDeepEqual(ctx.toString(ctx.n(5n, 0)), '0.5000000');
  },

  'leading fractional zeros (e < 0)': () => {
    // e=-2 → decPt=-2 → two leading zeros after "0."
    assertDeepEqual(ctx.toString(ctx.n(1234567n, -2)), '0.001234567');
  },

  'negative, decimal in middle': () => {
    assertDeepEqual(ctx.toString(ctx.n(-1234567n, 4)), '-1234.567');
  },

  'negative, pure fraction': () => {
    assertDeepEqual(ctx.toString(ctx.n(-5n, 0)), '-0.5000000');
  },

  'non-canonical m (sub-prec digits)': () => {
    // cancellation result {m: 1000n, e: 3} = 0.1 — d=4, decPt=0
    assertDeepEqual(ctx.toString(n(1000n, 3)), '0.1000');
  },

}).runTests();

new TestSuite('DapContext.cmp()', {
  'equal': () => {
    assertEqual(ctx.cmp(ctx.n('3'), ctx.n('3')), 0);
  },

  'greater': () => {
    assertEqual(ctx.cmp(ctx.n('5'), ctx.n('3')), 1);
  },

  'less': () => {
    assertEqual(ctx.cmp(ctx.n('3'), ctx.n('5')), -1);
  },

  'negative vs positive': () => {
    assertEqual(ctx.cmp(ctx.n('-1'), ctx.n('1')), -1);
  },

  'both negative': () => {
    assertEqual(ctx.cmp(ctx.n('-1'), ctx.n('-3')), 1);
  },

  'fractional': () => {
    assertEqual(ctx.cmp(ctx.n('0.5'), ctx.n('0.4')), 1);
  },

}).runTests();

new TestSuite('DapContext.eq() / equals()', {
  'equal values': () => {
    assertEqual(ctx.eq(ctx.n('3'), ctx.n('3')), true);
  },

  'unequal values': () => {
    assertEqual(ctx.eq(ctx.n('3'), ctx.n('4')), false);
  },

  'negative equal': () => {
    assertEqual(ctx.eq(ctx.n('-2'), ctx.n('-2')), true);
  },

  'positive vs negative': () => {
    assertEqual(ctx.eq(ctx.n('1'), ctx.n('-1')), false);
  },

  'zero equals zero': () => {
    assertEqual(ctx.eq(ctx.n('0'), ctx.n('0')), true);
  },

  'equals is same as eq': () => {
    assertEqual(ctx.equals, ctx.eq);
  },

}).runTests();

new TestSuite('DapContext.gt()', {
  'greater': () => {
    assertEqual(ctx.gt(ctx.n('5'), ctx.n('3')), true);
  },

  'less': () => {
    assertEqual(ctx.gt(ctx.n('3'), ctx.n('5')), false);
  },

  'equal': () => {
    assertEqual(ctx.gt(ctx.n('3'), ctx.n('3')), false);
  },

  'negative vs positive': () => {
    assertEqual(ctx.gt(ctx.n('-1'), ctx.n('1')), false);
  },

  'both negative, left is greater': () => {
    assertEqual(ctx.gt(ctx.n('-1'), ctx.n('-3')), true);
  },

}).runTests();

new TestSuite('DapContext.lt()', {
  'less': () => {
    assertEqual(ctx.lt(ctx.n('3'), ctx.n('5')), true);
  },

  'greater': () => {
    assertEqual(ctx.lt(ctx.n('5'), ctx.n('3')), false);
  },

  'equal': () => {
    assertEqual(ctx.lt(ctx.n('3'), ctx.n('3')), false);
  },

  'negative vs positive': () => {
    assertEqual(ctx.lt(ctx.n('-1'), ctx.n('1')), true);
  },

}).runTests();

new TestSuite('DapContext.gte()', {
  'greater': () => {
    assertEqual(ctx.gte(ctx.n('5'), ctx.n('3')), true);
  },

  'equal (boundary)': () => {
    assertEqual(ctx.gte(ctx.n('3'), ctx.n('3')), true);
  },

  'less': () => {
    assertEqual(ctx.gte(ctx.n('2'), ctx.n('3')), false);
  },

}).runTests();

new TestSuite('DapContext.lte()', {
  'less': () => {
    assertEqual(ctx.lte(ctx.n('2'), ctx.n('3')), true);
  },

  'equal (boundary)': () => {
    assertEqual(ctx.lte(ctx.n('3'), ctx.n('3')), true);
  },

  'greater': () => {
    assertEqual(ctx.lte(ctx.n('5'), ctx.n('3')), false);
  },

}).runTests();

new TestSuite('DapContext.add()', {
  'same exponent': () => {
    // 1.5 + 2.5 = 4.0
    assertDeepEqual(ctx.add(ctx.n(15n, 1), ctx.n(25n, 1)), ctx.n(4n, 1));
  },

  'different exponents': () => {
    // 100.0 + 5.0 = 105.0
    assertDeepEqual(ctx.add(ctx.n(1n, 3), ctx.n(5n, 1)), ctx.n(105n, 3));
  },

  'commutative (swap)': () => {
    // 5.0 + 100.0 = 105.0 — triggers the a/b swap
    assertDeepEqual(ctx.add(ctx.n(5n, 1), ctx.n(1n, 3)), ctx.n(105n, 3));
  },

  'overflow, no round': () => {
    // 9.0 + 2.0 = 11.0 — last digit of overflow is 0, no carry
    assertDeepEqual(ctx.add(ctx.n(9n, 1), ctx.n(2n, 1)), ctx.n(11n, 2));
  },

  'overflow, rounds up': () => {
    // 9.500005 + 1.0 = 10.50001 — last digit of overflow is 5, rounds up
    assertDeepEqual(ctx.add(ctx.n(9500005n, 1), ctx.n(1n, 1)), ctx.n(1050001n, 2));
  },

  'rounding during alignment': () => {
    // 100.0 + 0.5555555 = 100.5556 — dropped digits .555 round the kept digit up
    assertDeepEqual(ctx.add(ctx.n(1n, 3), ctx.n(5555555n, 0)), ctx.n(1005556n, 3));
  },

  'shift > prec, short-circuit': () => {
    // b is more than one position below a's floor — vanishes entirely
    assertDeepEqual(ctx.add(ctx.n(1234567n, 5), ctx.n(9999999n, -3)), ctx.n(1234567n, 5));
  },

  'shift === prec, rounds up': () => {
    // 1000000 + 0.5 = 1000001 — b's leading digit is exactly at the rounding position
    assertDeepEqual(ctx.add(ctx.n(1n, 7), ctx.n(5n, 0)), ctx.n(1000001n, 7));
  },

  'shift === prec, no round': () => {
    // 1000000 + 0.4999999 = 1000000 — b is below the rounding threshold
    assertDeepEqual(ctx.add(ctx.n(1n, 7), ctx.n(4999999n, 0)), ctx.n(1n, 7));
  },

  'subtraction via negative m': () => {
    // 5.0 + (-2.0) = 3.0
    assertDeepEqual(ctx.add(ctx.n(5n, 1), ctx.n(-2n, 1)), ctx.n(3n, 1));
  },

  'negative overflow': () => {
    // -9.0 + (-2.0) = -11.0
    assertDeepEqual(ctx.add(ctx.n(-9n, 1), ctx.n(-2n, 1)), ctx.n(-11n, 2));
  },

  'cancellation (result < prec digits in m)': () => {
    // 100.0 + (-99.9) = 0.1 — result m=1000 has only 4 digits, e unchanged
    assertDeepEqual(ctx.add(ctx.n(1n, 3), ctx.n(-999n, 2)), n(1000n, 3));
  },

  'zero operand': () => {
    // 0 + 5.0 = 5.0
    assertDeepEqual(ctx.add(ctx.n(0n, 0), ctx.n(5n, 1)), ctx.n(5n, 1));
  },

  'exact cancellation yields non-canonical zero': () => {
    // 5.0 + (-5.0) = 0, but e is inherited from a rather than reset to 0
    assertDeepEqual(ctx.add(ctx.n(5n, 1), ctx.n(-5n, 1)), n(0n, 1));
  },

}).runTests();

new TestSuite('DapContext.sub()', {
  'basic': () => {
    // 5.0 - 2.0 = 3.0
    assertDeepEqual(ctx.sub(ctx.n(5n, 1), ctx.n(2n, 1)), ctx.n(3n, 1));
  },

  'negative result': () => {
    // 2.0 - 5.0 = -3.0
    assertDeepEqual(ctx.sub(ctx.n(2n, 1), ctx.n(5n, 1)), ctx.n(-3n, 1));
  },

  'different exponents': () => {
    // 105.0 - 5.0 = 100.0
    assertDeepEqual(ctx.sub(ctx.n(105n, 3), ctx.n(5n, 1)), ctx.n(1n, 3));
  },

  'subtract zero': () => {
    assertDeepEqual(ctx.sub(ctx.n(1234567n, 2), ctx.n(0n, 0)), ctx.n(1234567n, 2));
  },

}).runTests();

const ctx3 = new DapContext(3);

new TestSuite('DapContext.mul()', {
  // --- prec-1 branch: mProd has 2*prec-1 = 13 digits ---

  'prec-1, no round': () => {
    // 2.0 × 3.0 = 6.0 — rem=0, nothing to round
    assertDeepEqual(ctx.mul(ctx.n(2n, 1), ctx.n(3n, 1)), ctx.n(6n, 1));
  },

  'prec-1, digit extraction, no round': () => {
    // 12.34567 × 10.00001 = 123.4568 — pulls digit 8 from rem, second digit 2 < 5
    assertDeepEqual(ctx.mul(ctx.n(1234567n, 2), ctx.n(1000001n, 2)), ctx.n(1234568n, 3));
  },

  'prec-1, rounds up': () => {
    // pi × e ≈ 8.539736 — pulls digit 5 from rem, second digit 7 rounds up
    assertDeepEqual(ctx.mul(ctx.n(3141593n, 1), ctx.n(2718282n, 1)), ctx.n(8539736n, 1));
  },

  'prec-1, different exponents': () => {
    // 200.0 × 30.0 = 6000.0
    assertDeepEqual(ctx.mul(ctx.n(2n, 3), ctx.n(3n, 2)), ctx.n(6n, 4));
  },

  'prec-1, identity': () => {
    // 12.34567 × 1.0 = 12.34567
    assertDeepEqual(ctx.mul(ctx.n(1234567n, 2), ctx.n(1n, 1)), ctx.n(1234567n, 2));
  },

  // --- prec branch: mProd has 2*prec = 14 digits ---

  'prec, no round': () => {
    // 99.99999² ≈ 9999.998 — rem=1, well below halfBase
    assertDeepEqual(ctx.mul(ctx.n(9999999n, 2), ctx.n(9999999n, 2)), ctx.n(9999998n, 4));
  },

  'prec, rounds up': () => {
    // 90.00001 × 5.556000 ≈ 500.0401 — rem=5556000 >= halfBase=5000000
    assertDeepEqual(ctx.mul(ctx.n(9000001n, 2), ctx.n(5556n, 1)), ctx.n(5000401n, 3));
  },

  // --- signs ---

  'negative × positive': () => {
    // -3.0 × 2.0 = -6.0
    assertDeepEqual(ctx.mul(ctx.n(-3n, 1), ctx.n(2n, 1)), ctx.n(-6n, 1));
  },

  'negative × negative': () => {
    // -2.0 × -3.0 = 6.0
    assertDeepEqual(ctx.mul(ctx.n(-2n, 1), ctx.n(-3n, 1)), ctx.n(6n, 1));
  },

  'prec, negative rounds up': () => {
    // -90.00001 × 5.556 ≈ -500.0401 — same magnitudes as positive case
    assertDeepEqual(ctx.mul(ctx.n(-9000001n, 2), ctx.n(5556n, 1)), ctx.n(-5000401n, 3));
  },

  // --- overflow handler (prec-1 branch rounds m up to base) ---
  // Requires prec=3 where reachable: 10.1 × 990 = 9999 → rounds to 10000
  // mProd=99990, m_initial=99, rem=990; pulls digit 9, second digit 9 rounds
  // 999 → 1000 = base → overflow handler fires → m=100, e++

  'prec-1 overflow handler (prec=3)': () => {
    assertDeepEqual(ctx3.mul(ctx3.n(101n, 2), ctx3.n(990n, 3)), ctx3.n(100n, 5));
  },

}).runTests();

new TestSuite('DapContext.div()', {
  // --- prec+1 branch: q = floor(|a.m| * base / |b.m|) has prec+1 digits ---

  'prec+1, no round': () => {
    // 6.0 / 2.0 = 3.0 — q=30000000, r=0
    assertDeepEqual(ctx.div(ctx.n('6'), ctx.n('2')), ctx.n('3'));
  },

  'prec+1, no round (non-trivial)': () => {
    // 7.0 / 2.0 = 3.5 — q=35000000, r=0
    assertDeepEqual(ctx.div(ctx.n('7'), ctx.n('2')), ctx.n('3.5'));
  },

  'prec+1, rounds up': () => {
    // 5.0 / 3.0 = 1.666667 — q=16666666, r=6 ≥ 5
    assertDeepEqual(ctx.div(ctx.n('5'), ctx.n('3')), ctx.n('1.666667'));
  },

  'prec+1, q === base (a === b)': () => {
    // 5.0 / 5.0 = 1.0 — q=base exactly, r=0
    assertDeepEqual(ctx.div(ctx.n('5'), ctx.n('5')), ctx.n('1'));
  },

  // --- prec branch: q has prec digits (|a.m| < |b.m|) ---

  'prec, no round': () => {
    // 1.0 / 3.0 = 0.3333333 — 2*rem=2000000 < absB=3000000
    assertDeepEqual(ctx.div(ctx.n('1'), ctx.n('3')), ctx.n('0.3333333'));
  },

  'prec, no round (different divisor)': () => {
    // 1.0 / 7.0 = 0.1428571 — 2*rem=6000000 < absB=7000000
    assertDeepEqual(ctx.div(ctx.n('1'), ctx.n('7')), ctx.n('0.1428571'));
  },

  'prec, rounds up': () => {
    // 2.0 / 3.0 = 0.6666667 — 2*rem=4000000 ≥ absB=3000000
    assertDeepEqual(ctx.div(ctx.n('2'), ctx.n('3')), ctx.n('0.6666667'));
  },

  // --- exponent ---

  'identity': () => {
    // 12.34567 / 1.0 = 12.34567
    assertDeepEqual(ctx.div(ctx.n(1234567n, 2), ctx.n('1')), ctx.n(1234567n, 2));
  },

  'a.e > b.e': () => {
    // 100.0 / 3.0 = 33.33333 — e = 3−1 = 2
    assertDeepEqual(ctx.div(ctx.n('100'), ctx.n('3')), ctx.n('33.33333'));
  },

  'a.e < b.e': () => {
    // 1.0 / 100.0 = 0.01 — e = 1−3+1 = −1
    assertDeepEqual(ctx.div(ctx.n('1'), ctx.n('100')), ctx.n('0.01'));
  },

  'a.e >> b.e': () => {
    // 1000.0 / 2.0 = 500.0 — prec branch, e = 4−1 = 3
    assertDeepEqual(ctx.div(ctx.n('1000'), ctx.n('2')), ctx.n('500'));
  },

  // --- signs ---

  'negative ÷ positive': () => {
    assertDeepEqual(ctx.div(ctx.n('-6'), ctx.n('2')), ctx.n('-3'));
  },

  'positive ÷ negative': () => {
    assertDeepEqual(ctx.div(ctx.n('6'), ctx.n('-2')), ctx.n('-3'));
  },

  'negative ÷ negative': () => {
    assertDeepEqual(ctx.div(ctx.n('-6'), ctx.n('-2')), ctx.n('3'));
  },

  'negative, prec rounds up': () => {
    // −2.0 / 3.0 = −0.6666667 — same magnitude as positive case, sign applied after
    assertDeepEqual(ctx.div(ctx.n('-2'), ctx.n('3')), ctx.n('-0.6666667'));
  },

  // --- zero ---

  'zero numerator': () => {
    // 0 / 5.0 — m=0, e = a.e − b.e = 0−1 = −1 (non-canonical zero)
    assertDeepEqual(ctx.div(ctx.n('0'), ctx.n('5')), n(0n, -1));
  },

}).runTests();

new TestSuite('DapContext.sqrt()', {
  'zero': () => {
    assertDeepEqual(ctx.sqrt(ctx.n('0')), n(0n, 0));
  },

  // --- perfect squares (r=0, no rounding) ---

  'sqrt(1) = 1 (odd e=1)': () => {
    assertDeepEqual(ctx.sqrt(ctx.n('1')), ctx.n('1'));
  },

  'sqrt(4) = 2 (odd e=1)': () => {
    assertDeepEqual(ctx.sqrt(ctx.n('4')), ctx.n('2'));
  },

  'sqrt(100) = 10 (odd e=3)': () => {
    assertDeepEqual(ctx.sqrt(ctx.n('100')), ctx.n('10'));
  },

  'sqrt(0.25) = 0.5 (even e=0)': () => {
    assertDeepEqual(ctx.sqrt(ctx.n('0.25')), ctx.n('0.5'));
  },

  // --- irrational, odd e (S = prec-1 branch) ---

  'sqrt(2) ≈ 1.414214 (odd e, rounds up)': () => {
    // isqrt=1414213, r=1590631 > x → rounds up
    assertDeepEqual(ctx.sqrt(ctx.n('2')), ctx.n('1.414214'));
  },

  'sqrt(3) ≈ 1.732051 (odd e, rounds up)': () => {
    // isqrt=1732050, r=2797500 > x → rounds up
    assertDeepEqual(ctx.sqrt(ctx.n('3')), ctx.n('1.732051'));
  },

  // --- irrational, even e (S = prec branch) ---

  'sqrt(10) ≈ 3.162278 (even e, rounds up)': () => {
    // isqrt=3162277, r=4184471 > x → rounds up
    assertDeepEqual(ctx.sqrt(ctx.n('10')), ctx.n('3.162278'));
  },

  'sqrt(0.5) ≈ 0.7071068 (even e, rounds up)': () => {
    // isqrt=7071067, r=11481511 > x → rounds up
    assertDeepEqual(ctx.sqrt(ctx.n('0.5')), ctx.n('0.7071068'));
  },

  // --- negative exponent ---

  'sqrt(0.01) = 0.1 (odd e=-1)': () => {
    assertDeepEqual(ctx.sqrt(ctx.n('0.01')), ctx.n('0.1'));
  },

  'sqrt(0.0004) = 0.02 (odd e=-3)': () => {
    assertDeepEqual(ctx.sqrt(ctx.n('0.0004')), ctx.n('0.02'));
  },

}).runTests();

new TestSuite('DapContext.neg()', {
  'zero': () => {
    // -0n === 0n in BigInt, so result is canonical zero
    assertDeepEqual(ctx.neg(ctx.n('0')), ctx.n('0'));
  },

  'negate positive': () => {
    assertDeepEqual(ctx.neg(ctx.n('1234.567')), ctx.n('-1234.567'));
  },

  'negate negative': () => {
    assertDeepEqual(ctx.neg(ctx.n('-1234.567')), ctx.n('1234.567'));
  },

  'exponent preserved': () => {
    assertDeepEqual(ctx.neg(ctx.n('0.001')), ctx.n('-0.001'));
  },

}).runTests();

new TestSuite('DapContext.trunc()', {
  'zero': () => {
    assertDeepEqual(ctx.trunc(ctx.n('0')), n(0n, 0));
  },

  'e < 0 (tiny fraction)': () => {
    // value is in (-0.1, 0.1) — all digits fractional
    assertDeepEqual(ctx.trunc(ctx.n('0.05')), n(0n, 0));
  },

  'e = 0, positive (< 1)': () => {
    assertDeepEqual(ctx.trunc(ctx.n('0.9999999')), n(0n, 0));
  },

  'e = 0, negative (> -1)': () => {
    // trunc rounds toward zero, so -0.9 → 0
    assertDeepEqual(ctx.trunc(ctx.n('-0.9999999')), n(0n, 0));
  },

  'positive decimal': () => {
    assertDeepEqual(ctx.trunc(ctx.n('1234.567')), ctx.n('1234'));
  },

  'negative decimal (toward zero, not floor)': () => {
    // -1234.567 truncates to -1234, not -1235
    assertDeepEqual(ctx.trunc(ctx.n('-1234.567')), ctx.n('-1234'));
  },

  'exact integer (e < prec)': () => {
    assertDeepEqual(ctx.trunc(ctx.n('1234')), ctx.n('1234'));
  },

  'large integer (e >= prec, returned as-is)': () => {
    assertDeepEqual(ctx.trunc(ctx.n('12345670')), ctx.n('12345670'));
  },

}).runTests();

new TestSuite('DapContext.round()', {
  'zero': () => {
    assertDeepEqual(ctx.round(ctx.n('0')), n(0n, 0));
  },

  'e < 0 (|value| < 0.1, always zero)': () => {
    assertDeepEqual(ctx.round(ctx.n('0.05')), n(0n, 0));
  },

  'e = 0, rounds up (0.5 → 1)': () => {
    // half-away-from-zero: 0.5 rounds to 1
    assertDeepEqual(ctx.round(ctx.n('0.5')), ctx.n('1'));
  },

  'e = 0, no round (< 0.5)': () => {
    assertDeepEqual(ctx.round(ctx.n('0.4999999')), n(0n, 0));
  },

  'e = 0, negative rounds away from zero (-0.5 → -1)': () => {
    assertDeepEqual(ctx.round(ctx.n('-0.5')), ctx.n('-1'));
  },

  'positive, rounds up': () => {
    // 1234.5 → rem=500 >= halfPow10[3]=500
    assertDeepEqual(ctx.round(ctx.n('1234.5')), ctx.n('1235'));
  },

  'positive, no round': () => {
    // 1234.499 → rem=499 < 500
    assertDeepEqual(ctx.round(ctx.n('1234.499')), ctx.n('1234'));
  },

  'negative, rounds away from zero': () => {
    assertDeepEqual(ctx.round(ctx.n('-1234.5')), ctx.n('-1235'));
  },

  'negative, no round': () => {
    assertDeepEqual(ctx.round(ctx.n('-1234.499')), ctx.n('-1234'));
  },

  'carry into new digit (9.5 → 10)': () => {
    // q = 9+1 = 10 >= pow10[1] → e increments from 1 to 2
    assertDeepEqual(ctx.round(ctx.n('9.5')), ctx.n('10'));
  },

  'exact integer (e >= prec, returned as-is)': () => {
    assertDeepEqual(ctx.round(ctx.n('1234567')), ctx.n('1234567'));
  },

}).runTests();

new TestSuite('DapContext.floor()', {
  'zero': () => {
    assertDeepEqual(ctx.floor(ctx.n('0')), n(0n, 0));
  },

  'e < 0, positive fraction → 0': () => {
    assertDeepEqual(ctx.floor(ctx.n('0.05')), n(0n, 0));
  },

  'e < 0, negative fraction → -1': () => {
    // any negative value in (-0.1, 0) floors to -1
    assertDeepEqual(ctx.floor(ctx.n('-0.05')), ctx.n('-1'));
  },

  'e = 0, positive (< 1) → 0': () => {
    assertDeepEqual(ctx.floor(ctx.n('0.9999999')), n(0n, 0));
  },

  'e = 0, negative (> -1) → -1': () => {
    // even a tiny negative value floors to -1
    assertDeepEqual(ctx.floor(ctx.n('-0.0000001')), ctx.n('-1'));
  },

  'positive decimal': () => {
    assertDeepEqual(ctx.floor(ctx.n('1234.001')), ctx.n('1234'));
  },

  'positive exact integer': () => {
    assertDeepEqual(ctx.floor(ctx.n('1234')), ctx.n('1234'));
  },

  'negative decimal (floors down, away from zero)': () => {
    // -1234.001 floors to -1235, not -1234
    assertDeepEqual(ctx.floor(ctx.n('-1234.001')), ctx.n('-1235'));
  },

  'negative exact integer': () => {
    assertDeepEqual(ctx.floor(ctx.n('-1234')), ctx.n('-1234'));
  },

  'carry into new digit (-9.1 → -10)': () => {
    // q = -9, rem < 0 → q = -10 >= pow10[1] → e increments
    assertDeepEqual(ctx.floor(ctx.n('-9.1')), ctx.n('-10'));
  },

}).runTests();

new TestSuite('DapContext.ceil()', {
  'zero': () => {
    assertDeepEqual(ctx.ceil(ctx.n('0')), n(0n, 0));
  },

  'e < 0, positive fraction → 1': () => {
    // any positive value in (0, 0.1) ceils to 1
    assertDeepEqual(ctx.ceil(ctx.n('0.05')), ctx.n('1'));
  },

  'e < 0, negative fraction → 0': () => {
    assertDeepEqual(ctx.ceil(ctx.n('-0.05')), n(0n, 0));
  },

  'e = 0, positive (> 0) → 1': () => {
    assertDeepEqual(ctx.ceil(ctx.n('0.0000001')), ctx.n('1'));
  },

  'e = 0, negative (> -1) → 0': () => {
    assertDeepEqual(ctx.ceil(ctx.n('-0.9999999')), n(0n, 0));
  },

  'positive decimal': () => {
    assertDeepEqual(ctx.ceil(ctx.n('1234.001')), ctx.n('1235'));
  },

  'positive exact integer': () => {
    assertDeepEqual(ctx.ceil(ctx.n('1234')), ctx.n('1234'));
  },

  'negative decimal (ceils toward zero)': () => {
    // -1234.567 ceils to -1234
    assertDeepEqual(ctx.ceil(ctx.n('-1234.567')), ctx.n('-1234'));
  },

  'negative exact integer': () => {
    assertDeepEqual(ctx.ceil(ctx.n('-1234')), ctx.n('-1234'));
  },

  'carry into new digit (9.1 → 10)': () => {
    // q = 9+1 = 10 >= pow10[1] → e increments
    assertDeepEqual(ctx.ceil(ctx.n('9.1')), ctx.n('10'));
  },

}).runTests();

new TestSuite('DapContext.mod()', {
  'basic': () => {
    // 7 - 3*floor(7/3) = 7 - 6 = 1
    assertDeepEqual(ctx.mod(ctx.n('7'), ctx.n('3')), ctx.n('1'));
  },

  'exact multiple (zero result)': () => {
    // cancellation in sub leaves non-canonical zero with inherited e
    assertDeepEqual(ctx.mod(ctx.n('9'), ctx.n('3')), n(0n, 1));
  },

  'dividend < divisor (result = dividend)': () => {
    // floor(2/5)=0, so result is just 2
    assertDeepEqual(ctx.mod(ctx.n('2'), ctx.n('5')), ctx.n('2'));
  },

  'negative dividend, positive divisor': () => {
    // floor(-7/3) = floor(-2.333) = -3; -7 - 3*(-3) = 2 — result is positive
    assertDeepEqual(ctx.mod(ctx.n('-7'), ctx.n('3')), ctx.n('2'));
  },

  'positive dividend, negative divisor': () => {
    // floor(7/-3) = floor(-2.333) = -3; 7 - (-3)*(-3) = -2 — result is negative
    assertDeepEqual(ctx.mod(ctx.n('7'), ctx.n('-3')), ctx.n('-2'));
  },

  'both negative': () => {
    // floor(-7/-3) = floor(2.333) = 2; -7 - (-3)*2 = -1
    assertDeepEqual(ctx.mod(ctx.n('-7'), ctx.n('-3')), ctx.n('-1'));
  },

  'sign follows divisor (contrast with truncated %)': () => {
    // floored: -1 mod 3 = 2 (positive); truncated remainder would give -1
    assertDeepEqual(ctx.mod(ctx.n('-1'), ctx.n('3')), ctx.n('2'));
  },

  'fractional': () => {
    // floor(0.7/0.3) = floor(2.333) = 2; 0.7 - 0.3*2 = 0.1
    assertDeepEqual(ctx.mod(ctx.n('0.7'), ctx.n('0.3')), ctx.n('0.1'));
  },

}).runTests();

new TestSuite('DapContext.ln()', {
  'ln(1) = 0': () => {
    assertEqual(ctx.toString(ctx.ln(ctx.n('1'))), '0');
  },

  'ln(4) ≈ 1.386294 (= 2*ln(2), tests k-fold halving)': () => {
    assertApprox(ctx.toString(ctx.ln(ctx.n('4'))), '1.386294');
  },

  'ln(2) ≈ 0.6931472': () => {
    assertApprox(ctx.toString(ctx.ln(ctx.n('2'))), '0.693147');
  },

  'ln(10) ≈ 2.302585': () => {
    assertApprox(ctx.toString(ctx.ln(ctx.n('10'))), '2.302585');
  },

  'ln(0.5) ≈ -0.6931472': () => {
    assertApprox(ctx.toString(ctx.ln(ctx.n('0.5'))), '-0.693147');
  },

  'ln(100) ≈ 4.605170': () => {
    assertApprox(ctx.toString(ctx.ln(ctx.n('100'))), '4.605170');
  },

  'throws for zero': () => {
    assertThrows(() => ctx.ln(ctx.n('0')), 'ln: argument must be positive');
  },

  'throws for negative': () => {
    assertThrows(() => ctx.ln(ctx.n('-1')), 'ln: argument must be positive');
  },

}).runTests();

new TestSuite('DapContext.exp()', {
  'exp(0) = 1': () => {
    assertDeepEqual(ctx.exp(ctx.n('0')), ctx.n('1'));
  },

  'exp(1) ≈ 2.718282': () => {
    assertApprox(ctx.toString(ctx.exp(ctx.n('1'))), '2.718282');
  },

  'exp(-1) ≈ 0.3678794': () => {
    assertApprox(ctx.toString(ctx.exp(ctx.n('-1'))), '0.3678794');
  },

  'exp(0.5) ≈ 1.648721': () => {
    assertApprox(ctx.toString(ctx.exp(ctx.n('0.5'))), '1.648721');
  },

  'exp(2) ≈ 7.389056': () => {
    assertApprox(ctx.toString(ctx.exp(ctx.n('2'))), '7.389056');
  },

}).runTests();

new TestSuite('DapContext.pow()', {
  'a^0 = 1': () => {
    assertDeepEqual(ctx.pow(ctx.n('5'), ctx.n('0')), ctx.n('1'));
  },

  '0^b = 0': () => {
    assertDeepEqual(ctx.pow(ctx.n('0'), ctx.n('3')), n(0n, 0));
  },

  'integer exponent: 2^10 = 1024': () => {
    assertDeepEqual(ctx.pow(ctx.n('2'), ctx.n('10')), ctx.n('1024'));
  },

  'integer exponent: 3^3 = 27': () => {
    assertDeepEqual(ctx.pow(ctx.n('3'), ctx.n('3')), ctx.n('27'));
  },

  'negative integer exponent: 2^-3 = 0.125': () => {
    assertEqual(ctx.toString(ctx.pow(ctx.n('2'), ctx.n('-3'))), '0.1250000');
  },

  'negative base, even exponent: (-2)^4 = 16': () => {
    assertDeepEqual(ctx.pow(ctx.n('-2'), ctx.n('4')), ctx.n('16'));
  },

  'negative base, odd exponent: (-2)^3 = -8': () => {
    assertDeepEqual(ctx.pow(ctx.n('-2'), ctx.n('3')), ctx.n('-8'));
  },

  'fractional exponent: 2^0.5 ≈ 1.414214': () => {
    assertApprox(ctx.toString(ctx.pow(ctx.n('2'), ctx.n('0.5'))), '1.414214');
  },

  'negative fractional exponent: 2^-0.5 ≈ 0.7071068': () => {
    assertApprox(ctx.toString(ctx.pow(ctx.n('2'), ctx.n('-0.5'))), '0.70710');
  },

  'throws: negative base with non-integer exponent': () => {
    assertThrows(() => ctx.pow(ctx.n('-2'), ctx.n('0.5')), 'pow: non-integer exponent requires positive base');
  },

}).runTests();

new TestSuite('DapContext.atanh()', {
  'atanh(0) = 0': () => {
    assertEqual(ctx.toString(ctx.atanh(ctx.n('0'))), '0');
  },

  'atanh(1/3) ≈ 0.3465736': () => {
    assertApprox(ctx.toString(ctx.atanh(ctx.n('0.3333333'))), '0.3465736');
  },

  'atanh(-1/3) ≈ -0.3465736': () => {
    assertApprox(ctx.toString(ctx.atanh(ctx.n('-0.3333333'))), '-0.3465736');
  },

  'atanh(0.5) ≈ 0.5493061': () => {
    assertApprox(ctx.toString(ctx.atanh(ctx.n('0.5'))), '0.5493061');
  },

  'atanh(-0.5) ≈ -0.5493061': () => {
    assertApprox(ctx.toString(ctx.atanh(ctx.n('-0.5'))), '-0.5493061');
  },

  'atanh(2/3) ≈ 0.8047190': () => {
    assertApprox(ctx.toString(ctx.atanh(ctx.n('0.6666667'))), '0.804719');
  },

  'atanh is odd: atanh(-x) = -atanh(x)': () => {
    const x = ctx.n('0.7');
    assertEqual(
      ctx.toString(ctx.atanh(ctx.neg(x))),
      ctx.toString(ctx.neg(ctx.atanh(x)))
    );
  },

}).runTests();