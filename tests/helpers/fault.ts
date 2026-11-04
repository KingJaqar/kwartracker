import { AppError } from '../../src/domain/errors.ts';

export function failAt(target: string) {
  return (point: string) => { if (point === target) throw new AppError('INJECTED_FAILURE'); };
}
