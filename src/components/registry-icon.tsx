import { createElement } from 'react';
import { iconForKey } from '@/theme/icons';
import { metrics } from '@/theme/tokens';

/** Resolve an existing registry component; no component definition is created during render. */
export function RegistryIcon({ name, color }: { name: string; color: string }) {
  return createElement(iconForKey(name), { color, size: metrics.icon, strokeWidth: metrics.iconStroke, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
}
