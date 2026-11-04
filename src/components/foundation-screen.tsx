import { isLoaded } from 'expo-font';
import { Platform, StyleSheet, Text, View, type TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';
import { useAppTheme } from '@/theme/provider';
import { fontFamily, iosFontFamily, metrics, spacing, typography } from '@/theme/tokens';

export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: keyof typeof typography }) {
  const { colors } = useAppTheme();
  const type = typography[variant];
  const family = Platform.OS === 'ios' ? iosFontFamily : fontFamily;
  const font = type.fontWeight === '700' ? family.bold : type.fontWeight === '600' ? family.semibold : type.fontWeight === '500' ? family.medium : family.regular;
  return <Text {...props} maxFontSizeMultiplier={metrics.fontScaleMax} style={[type, { color: colors.textPrimary, fontFamily: isLoaded(font) ? font : undefined }, style]} />;
}

export function FoundationScreen({ title, message = 'Your private, offline workspace.', children }: PropsWithChildren<{ title: string; message?: string }>) {
  const { colors } = useAppTheme();
  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
    <View style={styles.content}>
      <AppText variant="titleL" accessibilityRole="header">{title}</AppText>
      <AppText style={{ color: colors.textSecondary }}>{message}</AppText>
      {children}
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, padding: spacing.s4, gap: spacing.s4 },
});
