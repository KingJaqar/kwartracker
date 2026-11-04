import { AppError } from './errors.ts';

export type CanonicalValue = null | boolean | string | number | CanonicalValue[] | { [key: string]: CanonicalValue };

/** Restricted JCS domain: ASCII keys, finite safe integers, well-formed Unicode. */
export function canonicalJson(value: CanonicalValue): string {
  return encode(value, new Set<object>());
}

function encode(value: CanonicalValue, ancestors: Set<object>): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++index);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new AppError('INVALID_COMMAND');
      } else if (code >= 0xdc00 && code <= 0xdfff) throw new AppError('INVALID_COMMAND');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new AppError('INVALID_COMMAND');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || ancestors.has(value)) throw new AppError('INVALID_COMMAND');
  ancestors.add(value);
  if (Array.isArray(value)) {
    const result = `[${value.map(item => encode(item, ancestors)).join(',')}]`;
    ancestors.delete(value);
    return result;
  }
  const keys = Object.keys(value).sort();
  if (keys.some(key => !/^[\x20-\x7e]+$/.test(key))) throw new AppError('INVALID_COMMAND');
  const result = `{${keys.map(key => `${JSON.stringify(key)}:${encode(value[key], ancestors)}`).join(',')}}`;
  ancestors.delete(value);
  return result;
}
