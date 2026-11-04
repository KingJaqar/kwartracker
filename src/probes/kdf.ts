import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes } from '@noble/hashes/utils.js';
import { AppError } from '../domain/errors.ts';

/** Fixed-length, no early-exit comparison; JS JIT constant-time review remains SEC-REV-01 evidence. */
export function equalVerifier(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== 32 || right.length !== 32) throw new AppError('INVALID_COMMAND');
  let difference = 0;
  for (let index = 0; index < 32; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

/** Synthetic candidate only. No production credential enrollment or selected KDF implementation. */
export async function probePbkdf2(signal?: AbortSignal) {
  const salt = hexToBytes('000102030405060708090a0b0c0d0e0f');
  const start = performance.now();
  if (signal?.aborted) throw new AppError('CANCELLED');
  const derived = await pbkdf2Async(sha256, '246813', salt, { c: 600000, dkLen: 32, asyncTick: 5 });
  const milliseconds = performance.now() - start;
  try {
    if (signal?.aborted) throw new AppError('CANCELLED');
    // Pinned independent Node/OpenSSL vector is checked by host tests before native timing.
    const expected = hexToBytes('a0616cdcf5c1d42284c556043fb6aebb9ae3e161802b53a9e0ba1508aed5ec6b');
    return { candidate: '@noble/hashes@2.4.0 (JavaScript, unselected)', milliseconds, within750ms: milliseconds <= 750, vectorMatches: equalVerifier(derived, expected), constantTimeNativeReview: 'pending' };
  } finally { derived.fill(0); salt.fill(0); }
}
