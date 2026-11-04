import { AppError } from './errors.ts';

export const MAX_MONEY_MINOR = 1_000_000_000_000n;
type Rational = { numerator: bigint; denominator: bigint };

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) throw new AppError('DIVISION_BY_ZERO');
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

/** Exact arithmetic; a bounded recursive descent parser, never eval/Number arithmetic. */
export function evaluateExpression(input: string, decimalSeparator = '.'): Rational {
  if (input.length > 256) throw new AppError('INPUT_TOO_COMPLEX');
  if (decimalSeparator.length !== 1 || /[0-9+*/()\s-]/.test(decimalSeparator)) throw new AppError('INVALID_AMOUNT');
  const expression = input.replaceAll('−', '-').replaceAll('×', '*').replaceAll('÷', '/');
  let cursor = 0;
  const skip = () => { while (/\s/.test(expression[cursor] ?? '') && cursor < expression.length) cursor++; };
  function primary(depth: number): Rational {
    skip();
    if (depth > 16) throw new AppError('INPUT_TOO_COMPLEX');
    if (expression[cursor] === '-') { cursor++; const value = primary(depth); return rational(-value.numerator, value.denominator); }
    if (expression[cursor] === '(') {
      cursor++;
      const value = sum(depth + 1);
      skip();
      if (expression[cursor++] !== ')') throw new AppError('INVALID_AMOUNT');
      return value;
    }
    const start = cursor;
    while (/[0-9]/.test(expression[cursor] ?? '')) cursor++;
    let decimals = 0;
    if (expression[cursor] === decimalSeparator) {
      cursor++;
      const fractionStart = cursor;
      while (/[0-9]/.test(expression[cursor] ?? '')) cursor++;
      decimals = cursor - fractionStart;
    }
    const token = expression.slice(start, cursor);
    const digits = token.replace(decimalSeparator, '');
    if (!digits || !/^[0-9]+$/.test(digits)) throw new AppError('INVALID_AMOUNT');
    return rational(BigInt(digits), 10n ** BigInt(decimals));
  }
  function product(depth: number): Rational {
    let value = primary(depth);
    skip();
    while (expression[cursor] === '*' || expression[cursor] === '/') {
      const operator = expression[cursor++];
      const right = primary(depth);
      value = operator === '*'
        ? rational(value.numerator * right.numerator, value.denominator * right.denominator)
        : rational(value.numerator * right.denominator, value.denominator * right.numerator);
      skip();
    }
    return value;
  }
  function sum(depth: number): Rational {
    let value = product(depth);
    skip();
    while (expression[cursor] === '+' || expression[cursor] === '-') {
      const operator = expression[cursor++];
      const right = product(depth);
      value = rational(value.numerator * right.denominator + (operator === '+' ? 1n : -1n) * right.numerator * value.denominator,
        value.denominator * right.denominator);
      skip();
    }
    return value;
  }
  const value = sum(0);
  skip();
  if (cursor !== expression.length) throw new AppError('INVALID_AMOUNT');
  return value;
}

/** Exact half-up rounding of numerator/denominator (denominator > 0); a negative half tie rounds away from zero. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const magnitude = numerator < 0n ? -numerator : numerator;
  const rounded = magnitude / denominator + (magnitude % denominator * 2n >= denominator ? 1n : 0n);
  return numerator < 0n ? -rounded : rounded;
}

export function amountFromExpression(input: string, options: { openingBalance?: boolean; decimalSeparator?: string } = {}): bigint {
  const result = evaluateExpression(input, options.decimalSeparator);
  const minor = roundHalfUp(result.numerator * 100n, result.denominator);
  if (!options.openingBalance && minor <= 0n) throw new AppError('INVALID_AMOUNT');
  if (minor < -MAX_MONEY_MINOR || minor > MAX_MONEY_MINOR) throw new AppError('AMOUNT_OUT_OF_RANGE');
  return minor;
}

export function storedMinor(value: unknown, openingBalance = false): bigint {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new AppError('INVALID_AMOUNT');
  const minor = BigInt(value);
  if ((!openingBalance && minor <= 0n) || minor < -MAX_MONEY_MINOR || minor > MAX_MONEY_MINOR) throw new AppError('INVALID_AMOUNT');
  return minor;
}

export function safeInteger(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new AppError('AMOUNT_OUT_OF_RANGE');
  return Number(value);
}

export type MoneyPreferences = { currencySign: string; currencyPosition: 'prefix' | 'suffix'; displayDecimalPlaces: 0 | 2 };

/** No narrowing of unbounded totals; display rounding never changes the stored value. */
export function formatMoney(minor: bigint, preferences: MoneyPreferences, decimalSeparator = '.'): string {
  const magnitude = minor < 0n ? -minor : minor;
  const amount = preferences.displayDecimalPlaces === 0 ? roundHalfUp(magnitude, 100n).toString()
    : `${magnitude / 100n}${decimalSeparator}${(magnitude % 100n).toString().padStart(2, '0')}`;
  const signed = minor < 0n ? `−${amount}` : amount;
  return preferences.currencyPosition === 'prefix' ? `${preferences.currencySign}${signed}` : `${signed}${preferences.currencySign}`;
}
