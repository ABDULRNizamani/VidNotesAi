import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';
import { Layout } from '@/constants/layout';
import { Spacing } from '@/constants/spacing';

type CardVariant = 'default' | 'elevated' | 'glass';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  padding?: number;
  radius?: number;
}

const variantStyles: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  glass: {
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
};

export function Card({
  children,
  variant = 'default',
  style,
  padding = Layout.cardPadding,
  radius = Layout.borderRadius.lg,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variantStyles[variant],
        { padding, borderRadius: radius },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
