import { categoryPalette, colors } from './tokens.ts';

export type UiMode = 'system' | 'dark' | 'light';
export function resolveAppearance(uiMode: unknown, system: string | null | undefined): 'light' | 'dark' {
  if (uiMode === 'dark' || uiMode === 'light') return uiMode;
  return system === 'dark' ? 'dark' : 'light';
}
export function categoryColor(id: string, appearance: keyof typeof colors): string {
  const prefix = id.slice(0, 8);
  const index = /^[0-9a-f]{8}$/i.test(prefix) ? Number.parseInt(prefix, 16) % 12 : 0;
  return categoryPalette[appearance][index];
}
