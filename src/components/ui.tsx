import { Component, createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, BackHandler, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './foundation-screen';
import { useAppTheme } from '@/theme/provider';
import { fontFamily, iosFontFamily, layout, metrics, motion, opacity, radius, spacing, typography } from '@/theme/tokens';
import { icons } from '@/theme/icons';
import { RegistryIcon } from './registry-icon';
import { categoryColor } from '@/theme/appearance';
import { errorMessage } from '@/domain/errors';
import { haptic } from '@/services/ledger/haptics';
import { isLoaded } from 'expo-font';
import { scheduleOnRN } from 'react-native-worklets';

type Control = React.ComponentRef<typeof View> | null;
/** `then` runs once the exit animation has finished, keeping screen updates and navigation off the animating frames. */
type CloseOverlay = (then?: () => void) => void;
type OverlaySpec = { title: string; kind?: 'sheet' | 'dialog' | 'drawer'; destructive?: boolean; content: (close: CloseOverlay) => ReactNode; onClose?: () => void };
type OverlayApi = { show: (spec: OverlaySpec) => void; close: CloseOverlay; remember: (control: Control) => void; lock: (busy: boolean) => void; settled: () => boolean };
const OverlayContext = createContext<OverlayApi>({ show: () => { throw new Error('Overlay provider unavailable.'); }, close: () => undefined, remember: () => undefined, lock: () => undefined, settled: () => true });
const OverlaySurfaceContext = createContext(false);
export function useOverlay() { return useContext(OverlayContext); }

/** One queued modal layer; background is excluded from both touch and screen-reader traversal. */
export function OverlayProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState<(OverlaySpec & { invoker: Control }) | null>(null);
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const [queueVersion, setQueueVersion] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [warmup, setWarmup] = useState<'waiting' | 'mounted' | 'done'>('waiting');
  const queue = useRef<(OverlaySpec & { invoker: Control })[]>([]);
  const last = useRef<Control>(null);
  const closing = useRef(false);
  const busy = useRef(false);
  const after = useRef<(() => void)[]>([]);
  const current = useRef(active);
  const touched = useRef(0);
  const touch = useCallback(() => { touched.current = Date.now(); }, []);
  useLayoutEffect(() => { current.current = active; }, [active]);
  const close = useCallback<CloseOverlay>(then => {
    if (busy.current) return;
    if (!current.current) { then?.(); return; }
    if (then) after.current.push(then);
    if (closing.current) return;
    closing.current = true;
    setExiting(true);
  }, []);
  const finishClosing = useCallback(() => {
    const previous = current.current;
    previous?.onClose?.();
    for (const action of after.current.splice(0)) action();
    setActive(null);
    setExiting(false);
    if (previous?.invoker) AccessibilityInfo.sendAccessibilityEvent(previous.invoker, 'focus');
    setQueueVersion(value => value + 1);
  }, []);
  const show = useCallback((spec: OverlaySpec) => {
    queue.current.push({ ...spec, invoker: current.current?.invoker ?? last.current });
    Keyboard.dismiss(); setQueueVersion(value => value + 1); setWarmup('done');
  }, []);
  // Once the app is first idle; skipped if an overlay opens first, so it never runs during a sheet animation.
  useEffect(() => {
    if (warmup !== 'waiting') return;
    const idle = requestIdleCallback(() => setWarmup(state => state === 'waiting' ? 'mounted' : state));
    return () => cancelIdleCallback(idle);
  }, [warmup]);
  const warmed = useCallback(() => setWarmup('done'), []);
  useEffect(() => {
    const showing = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hiding = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { showing.remove(); hiding.remove(); };
  }, []);
  useEffect(() => {
    if (active || keyboard || !queue.current.length) return;
    const next = queue.current.shift();
    if (next) { closing.current = false; setExiting(false); setActive(next); if (next.destructive) haptic('warning'); }
  }, [active, keyboard, queueVersion]);
  const api = useMemo(() => ({ show, close, remember: (control: Control) => { last.current = control; }, lock: (value: boolean) => { busy.current = value; },
    // No overlay is open or queued and the screen has not been touched recently (touches bubble here from every gesture).
    settled: () => !current.current && queue.current.length === 0 && Date.now() - touched.current > motion.touchSettle }), [show, close]);
  return <OverlayContext.Provider value={api}>
    <View style={ui.flex} onTouchStart={touch} onTouchMove={touch} onTouchEnd={touch} accessibilityElementsHidden={Boolean(active)} importantForAccessibility={active ? 'no-hide-descendants' : 'auto'}>{children}</View>
    {active ? <OverlaySurfaceContext.Provider value><Overlay spec={active} close={close} exiting={exiting} finish={finishClosing} /></OverlaySurfaceContext.Provider> : null}
    {warmup === 'mounted' && !active ? <AnimationWarmup done={warmed} /> : null}
  </OverlayContext.Provider>;
}

/**
 * NFR-11: the first Reanimated view mounted in a process pays a one-time setup cost. On Records the first such view
 * is the sheet, so its first open ran a 57-62 ms task; one hidden animated view mounted at idle takes that cost instead.
 */
function AnimationWarmup({ done }: { done: () => void }) {
  const value = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: value.get() }));
  useEffect(() => {
    const frame = requestAnimationFrame(done);
    return () => cancelAnimationFrame(frame);
  }, [done]);
  return <Animated.View testID="animation-warmup" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[ui.warmup, style]} />;
}

function Overlay({ spec, close, exiting, finish }: { spec: OverlaySpec; close: CloseOverlay; exiting: boolean; finish: () => void }) {
  const { colors, appearance } = useAppTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const title = useRef<React.ComponentRef<typeof View>>(null);
  // Transition updates must not rebuild picker rows or reset their local input.
  const content = useMemo(() => spec.content(close), [spec, close]);
  const hiddenOffset = spec.kind === 'dialog' ? 0 : spec.kind === 'drawer' ? layout.drawerWidth : height;
  const drawer = spec.kind === 'drawer';
  const offset = useSharedValue(hiddenOffset);
  const fade = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: drawer ? [{ translateX: -offset.get() }] : [{ translateY: offset.get() }], opacity: fade.get() }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: fade.get() * opacity.scrim[appearance] }));
  useEffect(() => {
    if (exiting) {
      offset.set(withTiming(hiddenOffset, { duration: motion.dBase, easing: Easing.bezier(...motion.easeAccelerate), reduceMotion: ReduceMotion.System }));
      fade.set(withTiming(0, { duration: motion.dBase, reduceMotion: ReduceMotion.System }, complete => { if (complete) scheduleOnRN(finish); }));
    } else {
      offset.set(withTiming(0, { duration: motion.dSlow, easing: Easing.bezier(...motion.easeStandard), reduceMotion: ReduceMotion.System }));
      fade.set(withTiming(1, { duration: spec.kind === 'dialog' ? motion.dSlow : motion.dFast, reduceMotion: ReduceMotion.System }));
    }
  }, [offset, fade, exiting, finish, hiddenOffset, spec.kind]);
  const dismiss = useCallback(() => close(), [close]);
  // Stable across the exit render so the detector is not reconfigured while the sheet animates.
  const drag = useMemo(() => Gesture.Pan().runOnJS(true).onEnd(event => { if (event.translationY >= layout.sheetDismiss) dismiss(); }), [dismiss]);
  // Rendered in the app window rather than a native Modal (whose window creation cost frames over 100 ms),
  // so Back, keyboard avoidance and initial screen-reader focus are handled here.
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true; });
    const showing = Keyboard.addListener('keyboardDidShow', event => setKeyboardInset(event.endCoordinates.height));
    const hiding = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => { back.remove(); showing.remove(); hiding.remove(); };
  }, [dismiss]);
  useEffect(() => { if (title.current) AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus'); }, []);
  return <View style={[StyleSheet.absoluteFill, { bottom: keyboardInset }]}>
    <View style={[ui.overlay, spec.kind === 'dialog' && ui.dialogContainer]} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}><Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={dismiss} style={StyleSheet.absoluteFill} /></Animated.View>
      <Animated.View style={[ui.sheet, spec.kind === 'dialog' && ui.dialog, spec.kind === 'drawer' && ui.drawer, { backgroundColor: colors.surface3, paddingBottom: Math.max(insets.bottom, spacing.s4) }, style]}>
        {spec.kind !== 'dialog' && <GestureDetector gesture={drag}><View style={ui.handleTarget} accessible accessibilityLabel="Drag down to close"><View style={[ui.handle, { backgroundColor: colors.textSecondary }]} /></View></GestureDetector>}
        <View ref={title} accessible accessibilityRole="header"><AppText variant="titleM">{spec.title}</AppText></View>
        {content}
      </Animated.View>
    </View>
  </View>;
}

type ButtonProps = { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: 'primary' | 'secondary' | 'destructive'; icon?: string };
export function PopButton({ label, onPress, disabled, loading, variant = 'primary', icon }: ButtonProps) {
  const { colors } = useAppTheme();
  const { remember } = useOverlay();
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const press = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: press.get() }] }));
  const unavailable = Boolean(disabled || loading);
  const secondary = variant === 'secondary';
  const face = unavailable ? colors.surface3 : secondary ? colors.surface2 : variant === 'destructive' ? colors.danger : colors.accent;
  const text = unavailable ? colors.textTertiary : secondary ? colors.accent : variant === 'destructive' ? colors.onDanger : colors.onAccent;
  return <View style={[ui.buttonEdge, { backgroundColor: unavailable || secondary ? face : variant === 'destructive' ? colors.dangerEdge : colors.accentEdge }]}>
    <Animated.View style={animated}><Pressable ref={ref} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: unavailable, busy: Boolean(loading) }} disabled={unavailable}
      onPressIn={() => press.set(withTiming(secondary ? 0 : motion.pressTranslation, { duration: motion.dInstant, reduceMotion: ReduceMotion.System }))}
      onPressOut={() => press.set(withSpring(0, { ...motion.springPress, reduceMotion: ReduceMotion.System }))}
      onPress={() => { if (!unavailable) { remember(ref.current); onPress(); } }}
      style={[ui.button, { backgroundColor: face, borderColor: secondary ? colors.controlBorder : face }]}>
      {loading ? <ActivityIndicator color={text} size={layout.badge} /> : <>{icon ? <RegistryIcon name={icon} color={text} /> : null}<AppText variant="titleS" style={{ color: text, textAlign: 'center' }}>{label}</AppText></>}
    </Pressable></Animated.View>
  </View>;
}

export function GhostButton({ label, onPress, disabled = false }: Pick<ButtonProps, 'label' | 'onPress' | 'disabled'>) {
  const { colors } = useAppTheme(); const { remember } = useOverlay(); const open = useContext(OverlaySurfaceContext); const ref = useRef<React.ComponentRef<typeof View>>(null);
  return <Pressable ref={ref} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { remember(ref.current); onPress(); }} style={({ pressed }) => [ui.ghost, { opacity: pressed ? layout.pressedOpacity : 1 }]}><AppText variant="label" style={{ color: disabled ? colors.textTertiary : open ? colors.textPrimary : colors.accent }}>{label}</AppText></Pressable>;
}

export function IconButton({ label, icon, onPress, disabled = false, onAccent = false }: { label: string; icon: string; onPress: () => void; disabled?: boolean; onAccent?: boolean }) {
  const { colors } = useAppTheme(); const { remember } = useOverlay(); const ref = useRef<React.ComponentRef<typeof View>>(null);
  return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { remember(ref.current); onPress(); }} style={({ pressed }) => [ui.iconButton, pressed && { backgroundColor: onAccent ? colors.accent : colors.surface3 }]}><RegistryIcon name={icon} color={disabled ? colors.textTertiary : onAccent ? colors.onAccent : colors.textPrimary} /></Pressable>;
}

export function Card({ children, hero = false }: PropsWithChildren<{ hero?: boolean }>) {
  const { colors } = useAppTheme();
  return <View style={[ui.card, { borderColor: colors.divider, backgroundColor: colors.surface1 }, hero && { borderTopWidth: layout.heroHighlight, borderTopColor: colors.accent }]}>{children}</View>;
}
export function HeroCard({ children }: PropsWithChildren) { return <Card hero>{children}</Card>; }
export function MoneyText({ value, variant = 'bodyStrong', tone = 'normal' }: { value: string; variant?: 'bodyStrong' | 'displayXL' | 'displayL'; tone?: 'normal' | 'income' | 'neutral' }) {
  const { colors } = useAppTheme();
  return <AppText variant={variant} accessibilityLabel={value} style={{ fontVariant: ['tabular-nums'], color: tone === 'income' ? colors.income : tone === 'neutral' ? colors.textSecondary : colors.textPrimary }}>{value}</AppText>;
}

export function Badge({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return <View style={[ui.badge, { backgroundColor: colors.surface2 }]}><AppText variant="caption">{label}</AppText></View>;
}

export function IconTile({ id, icon }: { id: string; icon: string }) {
  const { colors, appearance } = useAppTheme(); const color = categoryColor(id, appearance);
  return <View style={[ui.tile, { backgroundColor: colors.surface1 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: opacity.categoryTile, borderRadius: radius.rMd }]} />
    <RegistryIcon name={icon} color={color} />
  </View>;
}

export function Chip({ label, selected, onPress, disabled = false }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors } = useAppTheme(); const Check = icons.check;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: Boolean(selected), disabled }} onPress={onPress} disabled={disabled} style={[ui.chip, { backgroundColor: colors.surface2, borderColor: selected ? colors.accent : colors.controlBorder }]}>
    {selected ? <Check color={colors.accent} size={metrics.icon} strokeWidth={metrics.iconStroke} /> : null}<AppText variant="label">{label}</AppText>
  </Pressable>;
}

function Segment({ label, value, selected, onChange, disabled }: { label: string; value: string; selected: boolean; onChange: (value: string) => void; disabled: boolean }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onChange(value)} style={ui.segment}>
    <AppText variant="label" style={{ textAlign: 'center', color: selected ? colors.textPrimary : colors.textSecondary }}>{label}</AppText>
  </Pressable>;
}
export function SegmentedControl({ options, value, onChange, disabled = false }: { options: readonly { label: string; value: string }[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(0);
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const position = useSharedValue(selected);
  const segmentWidth = options.length ? width / options.length : 0;
  useEffect(() => { position.set(withTiming(selected, { duration: motion.dFast, reduceMotion: ReduceMotion.System })); }, [position, selected]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * segmentWidth }] }));
  return <View accessibilityRole="radiogroup" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[ui.segments, { backgroundColor: colors.surface2 }]}>
    <Animated.View style={[ui.segmentPill, { width: segmentWidth, backgroundColor: colors.surface3 }, pill]} />
    {options.map(option => <Segment key={option.value} {...option} selected={value === option.value} onChange={onChange} disabled={disabled} />)}</View>;
}

const FormScrollContext = createContext<(input: TextInput) => void>(() => undefined);
export function TextField({ label, error, onBlur, onFocus, style, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const { colors } = useAppTheme(); const [focused, setFocused] = useState(false); const ref = useRef<TextInput>(null);
  const reveal = useContext(FormScrollContext);
  const family = Platform.OS === 'ios' ? iosFontFamily : fontFamily;
  return <View style={ui.gap}><AppText variant="label">{label}</AppText><TextInput ref={ref} {...props} accessibilityLabel={label} accessibilityHint={error ?? props.accessibilityHint} maxFontSizeMultiplier={metrics.fontScaleMax}
    placeholderTextColor={colors.textTertiary} selectionColor={colors.accent}
    onFocus={event => { setFocused(true); if (ref.current) reveal(ref.current); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[typography.body, ui.field, { color: colors.textPrimary, backgroundColor: props.editable === false ? colors.surface3 : colors.surface2, fontFamily: isLoaded(family.regular) ? family.regular : undefined, borderColor: error ? colors.danger : focused ? colors.accent : colors.controlBorder, borderWidth: focused || error ? layout.focusBorder : metrics.hairline }, style]} />
    {error ? <InlineError message={error} /> : null}
  </View>;
}

export function ListRowToggle({ label, value, onChange, disabled = false }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} style={ui.toggle}>
    <AppText style={ui.flex}>{label}</AppText><Switch accessible={false} focusable={false} importantForAccessibility="no-hide-descendants" value={value} disabled={disabled} onValueChange={onChange} thumbColor={value ? colors.onAccent : colors.textPrimary} trackColor={{ false: colors.controlBorder, true: colors.accent }} ios_backgroundColor={colors.controlBorder} />
  </Pressable>;
}

export function InlineError({ error, message, retry }: { error?: unknown; message?: string; retry?: () => void }) {
  const { colors } = useAppTheme(); const Warning = icons.warning;
  return <View accessibilityLiveRegion="polite" style={[ui.gap, { backgroundColor: colors.surface2, padding: spacing.s2, borderRadius: radius.rSm }]}><View style={ui.inline}>
    <Warning size={metrics.icon} color={colors.danger} strokeWidth={metrics.iconStroke} /><AppText style={[ui.flex, { color: colors.danger }]}>{message ?? errorMessage(error)}</AppText>
  </View>{retry ? <GhostButton label="Try again" onPress={retry} /> : null}</View>;
}

export function EmptyState({ title, message, action, onPress }: { title: string; message: string; action: string; onPress: () => void }) {
  const { colors } = useAppTheme(); const Glyph = icons.wallet;
  return <View style={ui.empty}><Glyph color={colors.accent} size={layout.rowHeight} strokeWidth={metrics.iconStroke} /><AppText variant="titleM">{title}</AppText><AppText style={{ textAlign: 'center', color: colors.textSecondary }}>{message}</AppText><PopButton label={action} onPress={onPress} /></View>;
}

export function Skeleton() {
  const [shown, setShown] = useState(false); const { colors } = useAppTheme();
  useEffect(() => { const timer = setTimeout(() => setShown(true), layout.skeletonDelay); return () => clearTimeout(timer); }, []);
  return <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={ui.gap}>{[0, 1, 2].map(key => <View key={key} style={[ui.skeleton, { backgroundColor: shown ? colors.surface2 : colors.bg }]} />)}</View>;
}

export function Toast({ message, onFinish }: { message: string; onFinish: () => void }) {
  const { colors } = useAppTheme();
  useEffect(() => { const timer = setTimeout(onFinish, layout.toastDuration); return () => clearTimeout(timer); }, [onFinish]);
  return <View accessibilityLiveRegion="polite" style={[ui.toast, { backgroundColor: colors.surface3 }]}><AppText>{message}</AppText></View>;
}

export function Dialog({ message, action, onConfirm, close, busy = false }: { message: string; action: string; onConfirm: () => void; close: () => void; busy?: boolean }) {
  return <View style={ui.gap}><AppText>{message}</AppText><PopButton label={action} variant="destructive" onPress={onConfirm} loading={busy} /><GhostButton label="Cancel" onPress={close} disabled={busy} /></View>;
}
export function BottomSheet({ children }: PropsWithChildren) { return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.gap}>{children}</ScrollView>; }

class RenderBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <View style={ui.content}><InlineError message="This screen could not be displayed. Your saved data is kept." retry={() => this.setState({ failed: false })} /></View> : this.props.children; }
}
export function ScreenBoundary({ children }: PropsWithChildren) { return <RenderBoundary>{children}</RenderBoundary>; }

export function Screen({ title, children, onBack, menu, dock, scroll = false }: PropsWithChildren<{ title: string; onBack?: () => void; menu?: () => void; dock?: ReactNode; scroll?: boolean }>) {
  const { colors } = useAppTheme();
  const scrollView = useRef<ScrollView>(null);
  const reveal = useCallback((input: TextInput) => { scrollView.current?.scrollResponderScrollNativeHandleToKeyboard(input, spacing.s4, true); }, []);
  return <SafeAreaView style={[ui.flex, { backgroundColor: colors.bg }]} edges={onBack ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}>
    <View style={ui.header}>{onBack ? <IconButton label="Back" icon="back" onPress={onBack} /> : null}<AppText variant="titleL" accessibilityRole="header" style={ui.flex}>{title}</AppText>{menu ? <IconButton label="Open menu" icon="menu" onPress={menu} /> : null}</View>
    <ScreenBoundary>{scroll ? <FormScrollContext.Provider value={reveal}><ScrollView ref={scrollView} style={ui.flex} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{children}</ScrollView></FormScrollContext.Provider> : <View style={ui.flex}>{children}</View>}{dock}</ScreenBoundary>
  </SafeAreaView>;
}

export const TransactionRow = memo(function TransactionRow({ id, title, icon, identity, subtitle, amount, type, refund, recurring, onPress }: { id: string; title: string; icon: string; identity: string; subtitle: string; amount: string; type: 'income' | 'expense' | 'transfer'; refund: boolean; recurring: boolean; onPress: (id: string) => void }) {
  const { colors } = useAppTheme(); const { fontScale } = useWindowDimensions(); const Marker = icons[type];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}, ${amount}${refund ? ', Refund' : ''}${recurring ? ', Recurring' : ''}`} onPress={() => onPress(id)} style={({ pressed }) => [ui.row, { backgroundColor: pressed ? colors.surface2 : colors.surface1, borderBottomColor: colors.divider }]}>
    <IconTile id={identity} icon={icon} /><View style={ui.flex}><AppText variant="titleS" numberOfLines={fontScale >= layout.nameWrapScale ? 2 : 1}>{title}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{subtitle}</AppText><View style={ui.inline}>{refund ? <Badge label="Refund" /> : null}{recurring ? <Badge label="Recurring" /> : null}</View></View>
    <View style={ui.amountColumn}><Marker size={metrics.icon} strokeWidth={metrics.iconStroke} color={type === 'income' ? colors.income : colors.textSecondary} /><MoneyText value={amount} tone={type === 'income' ? 'income' : type === 'transfer' ? 'neutral' : 'normal'} /></View>
  </Pressable>;
});

/** Budget bar at its final value, never animated; `over` fills full width in `expense` (callers add the icon and words). */
export function ProgressBar({ fill, over, label }: { fill: number; over: boolean; label: string }) {
  const { colors } = useAppTheme();
  const percent = Math.round(Math.min(1, Math.max(0, fill)) * 100);
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }} style={[ui.progress, { backgroundColor: colors.surface3 }]}>
    <View style={[ui.progressFill, { width: `${percent}%`, backgroundColor: over ? colors.expense : colors.accent }]} />
  </View>;
}

/** Analysis chart row: positive net Expense only, with its exact one-decimal share. */
export const RankedBarRow = memo(function RankedBarRow({ id, icon, name, amount, share, width }: { id: string; icon: string; name: string; amount: string; share: string; width: number }) {
  const { colors } = useAppTheme(); const { fontScale } = useWindowDimensions();
  return <View accessible accessibilityLabel={`${name}, ${amount}, ${share}`} style={ui.rankRow}>
    <View style={ui.inline}><IconTile id={id} icon={icon} /><AppText variant="titleS" style={ui.flex} numberOfLines={fontScale >= layout.nameWrapScale ? 2 : 1}>{name}</AppText><View style={ui.amountColumn}><MoneyText value={amount} /><AppText variant="caption" style={{ color: colors.textSecondary }}>{share}</AppText></View></View>
    <View style={[ui.rankTrack, { backgroundColor: colors.surface2 }]}><View style={[ui.rankFill, { width: `${width}%`, backgroundColor: colors.accent }]} /></View>
  </View>;
});

/** Analysis list row: every Expense category; a negative result reads "Net refund" with its icon, not color alone. */
export const RankedListRow = memo(function RankedListRow({ id, icon, name, amount, netRefund, archived }: { id: string; icon: string; name: string; amount: string; netRefund: boolean; archived: boolean }) {
  const { colors } = useAppTheme(); const { fontScale } = useWindowDimensions();
  return <View accessible accessibilityLabel={`${name}${archived ? ', Archived' : ''}, ${amount}${netRefund ? ', Net refund' : ''}`} style={[ui.row, { backgroundColor: colors.surface1, borderBottomColor: colors.divider }]}>
    <IconTile id={id} icon={icon} /><View style={ui.flex}><AppText variant="titleS" numberOfLines={fontScale >= layout.nameWrapScale ? 2 : 1}>{name}</AppText><View style={ui.inline}>{archived ? <Badge label="Archived" /> : null}{netRefund ? <Badge label="Net refund" /> : null}</View></View>
    <View style={ui.amountColumn}>{netRefund ? <RegistryIcon name="refund" color={colors.textSecondary} /> : null}<MoneyText value={amount} /></View>
  </View>;
});

export const ui = StyleSheet.create({
  flex: { flex: 1 }, gap: { gap: spacing.s2 }, content: { padding: spacing.s4, gap: spacing.s4, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s2, paddingHorizontal: spacing.s4, paddingVertical: spacing.s2 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s2 },
  buttonEdge: { borderRadius: radius.rMd, paddingBottom: motion.pressTranslation, minWidth: metrics.minTouch },
  button: { minHeight: metrics.primaryButton, paddingHorizontal: spacing.s4, paddingVertical: spacing.s2, borderRadius: radius.rMd, borderWidth: metrics.hairline, alignItems: 'center', justifyContent: 'center', gap: spacing.s2, flexDirection: 'row', flexWrap: 'wrap' },
  ghost: { minWidth: metrics.minTouch, minHeight: metrics.minTouch, padding: spacing.s2, justifyContent: 'center', alignItems: 'center' },
  iconButton: { minWidth: metrics.minTouch, minHeight: metrics.minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.rFull },
  card: { borderRadius: radius.rLg, borderWidth: metrics.hairline, padding: spacing.s4, gap: spacing.s3 },
  badge: { minHeight: layout.badge, borderRadius: radius.rFull, paddingHorizontal: spacing.s2, alignSelf: 'flex-start' },
  tile: { width: layout.tile, height: layout.tile, borderRadius: radius.rMd, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  chip: { minHeight: metrics.minTouch, minWidth: metrics.minTouch, paddingHorizontal: spacing.s3, paddingVertical: spacing.s2, borderRadius: radius.rFull, borderWidth: metrics.hairline, flexDirection: 'row', alignItems: 'center', gap: spacing.s1 },
  segments: { flexDirection: 'row', borderRadius: radius.rMd, overflow: 'hidden' },
  segmentPill: { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: radius.rMd },
  segment: { flex: 1, minHeight: metrics.minTouch, minWidth: metrics.minTouch, padding: spacing.s2, justifyContent: 'center', overflow: 'hidden' },
  field: { minHeight: metrics.primaryButton, borderRadius: radius.rMd, padding: spacing.s3, textAlignVertical: 'top' },
  toggle: { minHeight: metrics.minTouch, flexDirection: 'row', alignItems: 'center', gap: spacing.s3, paddingVertical: spacing.s2 },
  empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.s4, padding: spacing.s6 },
  skeleton: { minHeight: layout.rowHeight, borderRadius: radius.rLg },
  toast: { position: 'absolute', bottom: spacing.s4, left: spacing.s4, right: spacing.s4, padding: spacing.s4, borderRadius: radius.rMd },
  warmup: { position: 'absolute', width: metrics.hairline, height: metrics.hairline },
  overlay: { flex: 1, justifyContent: 'flex-end' }, dialogContainer: { justifyContent: 'center', alignItems: 'center', padding: spacing.s4 },
  sheet: { maxHeight: layout.sheetMaxHeight, padding: spacing.s4, gap: spacing.s4, borderTopLeftRadius: radius.rXl, borderTopRightRadius: radius.rXl },
  dialog: { width: '100%', maxWidth: layout.dialogWidth, borderRadius: radius.rLg },
  drawer: { width: layout.drawerWidth, maxWidth: layout.sheetMaxHeight, alignSelf: 'flex-start', height: '100%', borderTopRightRadius: radius.rXl },
  handleTarget: { minHeight: metrics.minTouch, justifyContent: 'center', alignItems: 'center' },
  handle: { width: layout.sheetHandleWidth, height: layout.sheetHandleHeight, borderRadius: radius.rFull },
  row: { minHeight: layout.rowHeight, flexDirection: 'row', alignItems: 'center', gap: spacing.s3, padding: spacing.s3, borderBottomWidth: metrics.hairline },
  amountColumn: { flexShrink: 1, alignItems: 'flex-end', maxWidth: '50%', gap: spacing.s1 },
  progress: { height: layout.progressBar, borderRadius: radius.rFull, overflow: 'hidden' },
  progressFill: { height: layout.progressBar, borderRadius: radius.rFull },
  rankRow: { paddingVertical: spacing.s3, gap: spacing.s2 },
  rankTrack: { height: layout.rankBar, borderRadius: radius.rFull, overflow: 'hidden' },
  rankFill: { height: layout.rankBar, borderRadius: radius.rFull },
});
