import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Layout } from '@/constants/layout';

const { width, height } = Dimensions.get('window');

export interface SlideData {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
}

interface OnboardingSlidePops {
  slide: SlideData;
}

export function OnboardingSlide({ slide }: OnboardingSlidePops) {
  return (
    <View style={styles.container}>
      {/* Illustration area */}
      <View style={styles.illustrationArea}>
        <View style={[styles.iconOuter, { backgroundColor: slide.iconBg }]}>
          <View style={[styles.iconInner, { backgroundColor: slide.iconColor + '22' }]}>
            <Ionicons name={slide.icon} size={64} color={slide.iconColor} />
          </View>
        </View>

        {/* Decorative rings */}
        <View style={[styles.ring, styles.ring1, { borderColor: slide.iconColor + '18' }]} />
        <View style={[styles.ring, styles.ring2, { borderColor: slide.iconColor + '10' }]} />
      </View>

      {/* Text area */}
      <View style={styles.textArea}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding * 1.5,
  },
  illustrationArea: {
    width: width * 0.65,
    height: width * 0.65,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  iconOuter: {
    width: 160,
    height: 160,
    borderRadius: Layout.borderRadius.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 120,
    height: 120,
    borderRadius: Layout.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 9999,
  },
  ring1: {
    width: 220,
    height: 220,
  },
  ring2: {
    width: 290,
    height: 290,
  },
  textArea: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 34,
  },
  body: {
    fontSize: Typography.size.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
  },
});
