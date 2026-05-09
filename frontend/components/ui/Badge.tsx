import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Layout } from '@/constants/layout';

type BadgeVariant = 'blue' | 'red' | 'success' | 'warning' | 'muted';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  blue:    { bg: 'rgba(74, 158, 255, 0.15)', text: Colors.blue.light },
  red:     { bg: 'rgba(255, 77, 109, 0.15)', text: Colors.red.light },
  success: { bg: 'rgba(52, 211, 153, 0.15)', text: Colors.success },
  warning: { bg: 'rgba(251, 191, 36, 0.15)', text: Colors.warning },
  muted:   { bg: Colors.surfaceHigh,          text: Colors.text.muted },
};

export function Badge({ label, variant = 'muted' }: BadgeProps) {
  const { bg, text } = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Layout.borderRadius.full,
  },
  label: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
