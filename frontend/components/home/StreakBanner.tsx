import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useStreak } from '@/hooks/useStreak';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Layout } from '@/constants/layout';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function StreakBanner() {
  const { streak, loading, collect } = useStreak();

  // Animation values
  const scale       = useSharedValue(1);
  const colorProg   = useSharedValue(streak.collectedToday ? 1 : 0);
  const milestoneAnim = useSharedValue(streak.isMilestone ? 1 : 0);

  const prevCollected = useRef(streak.collectedToday);

  useEffect(() => {
    colorProg.value = withTiming(streak.collectedToday ? 1 : 0, { duration: 600 });
    milestoneAnim.value = withTiming(streak.isMilestone ? 1 : 0, { duration: 400 });

    // Pulse animation on collect
    if (streak.collectedToday && !prevCollected.current) {
      scale.value = withSequence(
        withSpring(1.25, { damping: 4, stiffness: 200 }),
        withSpring(1,    { damping: 8, stiffness: 200 }),
      );
    }
    prevCollected.current = streak.collectedToday;
  }, [streak.collectedToday, streak.isMilestone]);

  const fireAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const milestoneRingStyle = useAnimatedStyle(() => ({
    opacity: milestoneAnim.value,
    transform: [{ scale: 0.8 + milestoneAnim.value * 0.2 }],
  }));

  const handleCollect = async () => {
    if (streak.collectedToday) return;
    await collect();
  };

  if (loading) return null;

  const fireColor  = streak.collectedToday ? Colors.blue.default : Colors.red.default;
  const fireColor2 = streak.collectedToday ? Colors.blue.light   : Colors.red.light;

  return (
    <View style={styles.card}>
      {/* Milestone ring — only visible on 10, 20, 30... */}
      {streak.isMilestone && (
        <Animated.View style={[styles.milestoneRing, milestoneRingStyle]} />
      )}

      {/* Fire icon */}
      <Animated.View style={[styles.fireWrap, fireAnimStyle]}>
        <Ionicons name="flame" size={48} color={fireColor} />
        {streak.isMilestone && (
          <View style={[styles.milestoneDot, { backgroundColor: fireColor2 }]} />
        )}
      </Animated.View>

      {/* Day count */}
      <Text style={[styles.dayCount, { color: fireColor }]}>
        {streak.current}
      </Text>
      <Text style={styles.dayLabel}>
        {streak.current === 1 ? 'day streak' : 'day streak'}
      </Text>

      {/* Milestone badge */}
      {streak.isMilestone && (
        <View style={[styles.milestoneBadge, { borderColor: fireColor2 }]}>
          <Ionicons name="trophy" size={12} color={fireColor2} />
          <Text style={[styles.milestoneText, { color: fireColor2 }]}>
            {streak.current} day milestone!
          </Text>
        </View>
      )}

      {/* Collect button */}
      <AnimatedTouchable
        style={[
          styles.collectBtn,
          streak.collectedToday
            ? { backgroundColor: 'rgba(74,158,255,0.12)', borderColor: Colors.blue.default }
            : { backgroundColor: 'rgba(255,77,109,0.12)', borderColor: Colors.red.default },
        ]}
        onPress={handleCollect}
        activeOpacity={0.75}
        disabled={streak.collectedToday}
      >
        <Ionicons
          name={streak.collectedToday ? 'checkmark-circle' : 'flame-outline'}
          size={18}
          color={streak.collectedToday ? Colors.blue.default : Colors.red.default}
        />
        <Text
          style={[
            styles.collectText,
            { color: streak.collectedToday ? Colors.blue.default : Colors.red.default },
          ]}
        >
          {streak.collectedToday ? 'Collected' : 'Collect Streak'}
        </Text>
      </AnimatedTouchable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Layout.screenPadding,
    gap: Spacing.xs,
    overflow: 'visible',
  },
  milestoneRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.blue.light,
    top: Spacing.lg,
    alignSelf: 'center',
  },
  fireWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  milestoneDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dayCount: {
    fontSize: Typography.size['3xl'],
    fontWeight: Typography.weight.bold,
    lineHeight: 36,
    letterSpacing: -1,
  },
  dayLabel: {
    fontSize: Typography.size.sm,
    color: Colors.text.muted,
    fontWeight: Typography.weight.medium,
    marginBottom: Spacing.sm,
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  milestoneText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.3,
  },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  collectText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
});
