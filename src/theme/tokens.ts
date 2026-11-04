export const colors = {
  dark: {
    bg: '#0E0F13', surface1: '#16181E', surface2: '#1E2129', surface3: '#282C37',
    textPrimary: '#F4F5F7', textSecondary: '#B3B9C6', textTertiary: '#9AA1B0',
    accent: '#8B7CFF', accentEdge: '#5A4BD6', onAccent: '#0E0F13',
    income: '#4BE0A0', expense: '#FF8A80', warning: '#FFC15E', danger: '#FF6B6B',
    dangerEdge: '#C94A4A', onDanger: '#0E0F13', controlBorder: '#6C7386', divider: '#262A33', scrim: '#000000',
  },
  light: {
    bg: '#F5F6F8', surface1: '#FFFFFF', surface2: '#F0F1F4', surface3: '#E6E8ED',
    textPrimary: '#13151A', textSecondary: '#454B59', textTertiary: '#5B6272',
    accent: '#4F3FE0', accentEdge: '#3326A8', onAccent: '#FFFFFF',
    income: '#0A6F48', expense: '#B3261E', warning: '#8A5200', danger: '#B3261E',
    dangerEdge: '#7F1913', onDanger: '#FFFFFF', controlBorder: '#7A8090', divider: '#E1E3E8', scrim: '#000000',
  },
} as const;
export const categoryPalette = {
  dark: ['#DF503A', '#DF873A', '#DFB63A', '#C3DF3A', '#7EDF3A', '#3ADF71', '#3ADFB6', '#3AC3DF', '#3A7EDF', '#7065E6', '#A34BE2', '#DF3AA8'],
  light: ['#DD4831', '#BD681F', '#9A7919', '#718415', '#488C17', '#189140', '#178C6F', '#1A889E', '#3A7EDF', '#5C50E2', '#A550E2', '#DD31A4'],
} as const;
export const spacing = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40 } as const;
export const radius = { rSm: 8, rMd: 12, rLg: 16, rXl: 24, rFull: 999 } as const;
export const typography = {
  displayXL: { fontSize: 40, lineHeight: 48, fontWeight: '700' },
  displayL: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  titleL: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  titleM: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  titleS: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;
export const motion = {
  dInstant: 70, dFast: 150, dBase: 200, dSlow: 280,
  easeStandard: [0.2, 0, 0, 1], easeAccelerate: [0.4, 0, 1, 1],
  springPress: { damping: 18, stiffness: 260 }, reducedOpacity: 100,
  passcodeShake: { translation: 8, cycles: 3, duration: 240 },
  pressTranslation: 3,
  /** Background work (tab preloading) waits this long after the last touch so it never lands inside a gesture. */
  touchSettle: 1000,
} as const;
export const metrics = { minTouch: 44, primaryButton: 52, key: 56, compactKey: 52, compactHeight: 700, icon: 24, iconStroke: 1.75, fontScaleMax: 2, hairline: 1 } as const;
export const opacity = { scrim: { dark: 0.56, light: 0.4 }, categoryTile: 0.12 } as const;
export const fontFamily = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' } as const;
export const iosFontFamily = { regular: 'Inter-Regular', medium: 'Inter-Medium', semibold: 'Inter-SemiBold', bold: 'Inter-Bold' } as const;
export const layout = {
  tabHeight: 64, activeTabBar: 3, tabIconOnlyScale: 1.4, nameWrapScale: 1.3,
  rowHeight: 64, tile: 40, badge: 20, heroHighlight: 2, focusBorder: 2,
  sheetMaxHeight: '90%', sheetHandleWidth: 36, sheetHandleHeight: 4, dialogWidth: 340,
  drawerWidth: 300, drawerEdge: 24, sheetDismiss: 72, modalKeyboardFallback: 500,
  fab: 56, listBottomPadding: 88, moneyMinScale: 0.5,
  skeletonDelay: 150, toastDuration: 3000, pressedOpacity: 0.6,
  keyColumns: 4, maximumInlineAccounts: 5, maximumInlineCategories: 6,
} as const;
