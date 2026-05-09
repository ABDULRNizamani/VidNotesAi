import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Layout } from '@/constants/layout';
import { Spacing } from '@/constants/spacing';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyle: Record<Variant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: Colors.blue.default },
    text: { color: Colors.text.primary },
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.blue.default,
    },
    text: { color: Colors.blue.default },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: Colors.text.secondary },
  },
  danger: {
    container: { backgroundColor: Colors.red.default },
    text: { color: Colors.text.primary },
  },
};

const sizeStyle: Record<Size, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Layout.borderRadius.md },
    text: { fontSize: Typography.size.sm },
  },
  md: {
    container: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 4, borderRadius: Layout.borderRadius.md },
    text: { fontSize: Typography.size.md },
  },
  lg: {
    container: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Layout.borderRadius.lg },
    text: { fontSize: Typography.size.lg },
  },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyle[variant].container,
        sizeStyle[size].container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? Colors.blue.default : Colors.text.primary}
        />
      ) : (
        <Text style={[styles.label, variantStyle[variant].text, sizeStyle[size].text]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.2,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
});
