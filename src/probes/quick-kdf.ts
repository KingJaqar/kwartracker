import { hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { AppError } from '../domain/errors';

/** Fixed synthetic candidate; selection requires measurements on both designated Android images. */
export async function probeQuickKdf(signal: AbortSignal) {
  if (signal.aborted) throw new AppError('CANCELLED');
  const password = utf8ToBytes('246813');
  const salt = hexToBytes('000102030405060708090a0b0c0d0e0f');
  const expected = hexToBytes('a0616cdcf5c1d42284c556043fb6aebb9ae3e161802b53a9e0ba1508aed5ec6b');
  let derived: Uint8Array | undefined;
  let mismatch: Uint8Array | undefined;
  try {
    const started = performance.now();
    // Lazy loading keeps older development APKs usable until the native rebuild is installed.
    const { pbkdf2, timingSafeEqual } = await import('react-native-quick-crypto');
    derived = await new Promise<Uint8Array>((resolve, reject) => {
      pbkdf2(password, salt, 600000, 32, 'sha256', (error, output) => {
        if (error) reject(error);
        else if (!output || output.length !== 32) reject(new AppError('PROBE_FAILED'));
        else resolve(output);
      });
    });
    const matches = timingSafeEqual(derived, expected);
    const milliseconds = performance.now() - started;
    mismatch = new Uint8Array(derived);
    mismatch[0] ^= 1;
    const rejectsMismatch = !timingSafeEqual(derived, mismatch);
    if (signal.aborted) throw new AppError('DEADLINE_EXCEEDED');
    return { candidate: 'react-native-quick-crypto1.1.9 fastpbkdf2/OpenSSL (unselected)', iterations: 600000, outputBits: 256, saltBits: 128, milliseconds, includesFirstModuleLoad: true, within750ms: milliseconds <= 750, vectorMatches: matches, rejectsMismatch, comparison: 'Fixed32-byte inputs; native CRYPTO_memcmp; source provenance retained. Full dependency review recorded separately.' };
  } finally { password.fill(0); salt.fill(0); expected.fill(0); derived?.fill(0); mismatch?.fill(0); }
}
