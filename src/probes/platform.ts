import { requireOptionalNativeModule } from 'expo';
import { AppError } from '../domain/errors';

type FoundationProbes = {
  probePbkdf2(): Promise<unknown>;
  probeDurableIo(): Promise<unknown>;
  restoreIo(operation: string, action: string, first: string, second: string): Promise<string>;
};

export async function probePlatform(operation: 'probePbkdf2' | 'probeDurableIo', signal?: AbortSignal) {
  if (signal?.aborted) throw new AppError('CANCELLED');
  const native = requireOptionalNativeModule<FoundationProbes>('KwartrackerFoundationProbes');
  if (!native) return {
    available: false,
    outcome: 'Install the separately reviewed Android foundation-probe APK containing the native module. Normal validation APKs exclude it.',
  };
  const result = await native[operation]();
  if (signal?.aborted) throw new AppError('DEADLINE_EXCEEDED');
  if (typeof result !== 'object' || result === null) throw new AppError('PROBE_FAILED');
  return result;
}

/** Only the separately packaged nonshipping module provides this restricted synthetic I/O. */
export async function restoreProbeIo(operation: string, action: string, first = '', second = '') {
  const native = requireOptionalNativeModule<FoundationProbes>('KwartrackerFoundationProbes');
  if (!native) throw new AppError('PROBE_FAILED');
  const result = await native.restoreIo(operation, action, first, second);
  if (typeof result !== 'string') throw new AppError('PROBE_FAILED');
  return result;
}
