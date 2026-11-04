import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, ReduceMotion } from 'react-native-reanimated';
import { AppText } from '@/components/foundation-screen';
import { icons } from '@/theme/icons';
import { metrics, motion, radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/provider';
import { beginUiObservation } from './ui-observation';

const FoodIcon = icons.food;
const SyntheticRow = memo(function SyntheticRow({ item }: { item: number }) {
  const { colors } = useAppTheme();
  return <View style={styles.row}>
    <FoodIcon size={metrics.icon} strokeWidth={metrics.iconStroke} color={colors.accent} />
    <AppText>{`Synthetic row ${item + 1}`}</AppText>
  </View>;
});
const renderItem = ({ item }: { item: number }) => <SyntheticRow item={item} />;
const keyExtractor = (item: number) => item.toString();
export function UiStackProbe() {
  const { colors } = useAppTheme();
  const control = [styles.control, { borderColor: colors.controlBorder, backgroundColor: colors.surface2 }];
  const data = useMemo(() => Array.from({ length: 10000 }, (_, index) => index), []);
  const [sequence, setSequence] = useState('');
  const [tab, setTab] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<'keypad' | 'motion' | 'list'>('keypad');
  const sequenceRef = useRef('');
  const keyTimes = useRef<number[]>([]);
  const [observation, setObservation] = useState('No performance sample started.');
  const sample = useRef<ReturnType<typeof beginUiObservation> | null>(null);
  const sampleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { sample.current?.disconnect(); if (sampleTimer.current !== null) clearTimeout(sampleTimer.current); }, []);
  function finishSample() {
    if (sampleTimer.current !== null) clearTimeout(sampleTimer.current);
    sampleTimer.current = null;
    if (sample.current === null) return;
    try {
      const span = keyTimes.current.length > 1 ? keyTimes.current[keyTimes.current.length - 1] - keyTimes.current[0] : null;
      setObservation(JSON.stringify({ ...sample.current.stop(), mode, sequence: sequenceRef.current, keyCount: keyTimes.current.length, keyRegistrationSpanMs: span }));
    } catch { setObservation('Performance observation failed; this sample cannot pass.'); }
    finally { sample.current.disconnect(); sample.current = null; }
  }
  function startSample() {
    if (sample.current !== null) return;
    try {
      sample.current = beginUiObservation();
      sequenceRef.current = ''; keyTimes.current = [];
      setSequence('');
      setObservation('Recording event latency and long tasks. Finish within 20 seconds.');
      sampleTimer.current = setTimeout(finishSample, 20000);
    } catch { sample.current?.disconnect(); sample.current = null; setObservation('Performance observation unavailable; this sample cannot pass.'); }
  }
  const offset = useSharedValue(0);
  const press = useSharedValue(0);
  const pill = useSharedValue(0);
  const banner = useSharedValue(0);
  const shake = useSharedValue(0);
  const sheetOffset = useSharedValue<number>(metrics.compactHeight);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.get() }] }));
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pill.get() }] }));
  const bannerStyle = useAnimatedStyle(() => ({ opacity: banner.get() }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetOffset.get() }] }));
  const gesture = Gesture.Pan().onUpdate(event => { offset.set(event.translationX); })
    .onEnd(() => { offset.set(withTiming(0, { duration: motion.dBase, reduceMotion: ReduceMotion.System })); });
  function showSheet(value: boolean) {
    setSheet(value);
    sheetOffset.set(withTiming(value ? 0 : metrics.compactHeight, { duration: value ? motion.dSlow : motion.dBase, reduceMotion: ReduceMotion.System }));
  }
  return <View style={styles.container}>
    <View style={styles.controls}>{(['keypad', 'motion', 'list'] as const).map(value => <Pressable key={value} accessibilityRole="button" style={control} onPress={() => { if (sample.current === null) { showSheet(false); setMode(value); } }}><AppText>{value}</AppText></Pressable>)}</View>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" style={control} onPress={startSample}><AppText>Start sample</AppText></Pressable>
      <Pressable accessibilityRole="button" style={control} onPress={finishSample}><AppText>Finish sample</AppText></Pressable>
    </View>
    <AppText numberOfLines={2} accessibilityLabel={observation}>{observation}</AppText>
    {mode !== 'list' && <GestureDetector gesture={gesture}><Animated.View style={style}><AppText>Drag this label.</AppText></Animated.View></GestureDetector>}
    {mode === 'keypad' && <>
    <Animated.View style={pressStyle}><AppText accessibilityLiveRegion="polite">{`Tap order: ${sequence || 'none'}`}</AppText></Animated.View>
    <View style={styles.controls}>{Array.from({ length: 10 }, (_, number) => <Pressable key={number} accessibilityRole="button" accessibilityLabel={`Synthetic key ${number}`} style={control} onPress={() => {
      sequenceRef.current = (sequenceRef.current + number).slice(-256);
      setSequence(sequenceRef.current);
      if (sample.current !== null && keyTimes.current.length < 256) keyTimes.current.push(performance.now());
      press.set(withSequence(withTiming(motion.pressTranslation, { duration: motion.dInstant, reduceMotion: ReduceMotion.System }), withSpring(0, { ...motion.springPress, reduceMotion: ReduceMotion.System })));
    }}><AppText>{number}</AppText></Pressable>)}</View></>}
    {mode === 'motion' && <><View style={styles.controls}>
      <Pressable accessibilityRole="button" style={control} onPress={() => {
        setTab(value => !value); pill.set(withTiming(tab ? 0 : spacing.s10, { duration: motion.dFast, reduceMotion: ReduceMotion.System }));
      }}><AppText>{`Switch tab (${tab ? 'B' : 'A'})`}</AppText></Pressable>
      <Pressable accessibilityRole="button" style={control} onPress={() => showSheet(true)}><AppText>Open sheet</AppText></Pressable>
      <Pressable accessibilityRole="button" style={control} onPress={() => banner.set(withSequence(withTiming(1, { duration: motion.dBase, reduceMotion: ReduceMotion.System }), withTiming(0, { duration: motion.dBase, reduceMotion: ReduceMotion.System })))}><AppText>Banner fade</AppText></Pressable>
      <Pressable accessibilityRole="button" style={control} onPress={() => {
        const transitions = motion.passcodeShake.cycles * 2 + 1;
        shake.set(withSequence(...Array.from({ length: transitions }, (_, index) => withTiming(index === transitions - 1 ? 0 : (index % 2 ? -1 : 1) * motion.passcodeShake.translation, { duration: motion.passcodeShake.duration / transitions, reduceMotion: ReduceMotion.System }))));
      }}><AppText>Shake indicator</AppText></Pressable>
    </View>
    <Animated.View style={pillStyle}><AppText>{`Selected ${tab ? 'B' : 'A'}`}</AppText></Animated.View>
    <Animated.View style={bannerStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><AppText>Synthetic banner</AppText></Animated.View>
    <Animated.View style={shakeStyle}><AppText>Six synthetic dots: ● ● ● ● ● ●</AppText></Animated.View></>}
    {mode === 'list' && <FlashList data={data} renderItem={renderItem} keyExtractor={keyExtractor} />}
    <Animated.View accessibilityElementsHidden={!sheet} importantForAccessibility={sheet ? 'yes' : 'no-hide-descendants'} pointerEvents={sheet ? 'auto' : 'none'} style={[styles.sheet, { backgroundColor: colors.surface3 }, sheetStyle]}>
      <AppText variant="titleM">Synthetic sheet</AppText>
      <Pressable accessibilityRole="button" style={control} onPress={() => showSheet(false)}><AppText>Close sheet</AppText></Pressable>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.s2 },
  row: { minHeight: metrics.minTouch, flexDirection: 'row', alignItems: 'center', gap: spacing.s3, padding: spacing.s3 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1 },
  control: { minWidth: metrics.minTouch, minHeight: metrics.minTouch, padding: spacing.s2, justifyContent: 'center', alignItems: 'center', borderWidth: metrics.hairline, borderRadius: radius.rMd },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.s4, borderRadius: radius.rXl, minHeight: metrics.primaryButton * 3 },
});
