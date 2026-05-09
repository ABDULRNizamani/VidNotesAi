import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Layout } from '@/constants/layout';

interface LockedFeatureProps {
  title?: string;
  message?: string;
  onSignUp?: () => void;  // optional — defaults to pushing auth/login
}

export function LockedFeature({
  title = 'Sign in to unlock',
  message = 'Create a free account to access this feature and sync your notes across devices.',
  onSignUp,
}: LockedFeatureProps) {
  const handlePress = () => {
    if (onSignUp) {
      onSignUp();
    } else {
      router.push('/auth/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={32} color={Colors.blue.default} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.8}>
        <Ionicons name="logo-google" size={18} color={Colors.text.primary} />
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    backgroundColor: Colors.background,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: Layout.borderRadius.xl,
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 158, 255, 0.2)',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: Typography.size.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.blue.default,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
    marginTop: Spacing.sm,
  },
  buttonText: {
    color: Colors.text.primary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
});
