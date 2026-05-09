import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Layout } from '@/constants/layout';

const BENEFITS = [
  { icon: 'cloud-upload-outline' as const,  text: 'Notes synced across all your devices' },
  { icon: 'help-circle-outline' as const,   text: 'Quiz and flashcard study tools' },
  { icon: 'chatbubble-ellipses-outline' as const, text: 'AI chatbot scoped to your notes' },
  { icon: 'stats-chart-outline' as const,   text: 'Track streaks and quiz performance' },
];

export default function Login() {
  const insets = useSafeAreaInsets();
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      // _layout.tsx will automatically redirect to /(tabs) when session is detected
    } catch (e: any) {
      if (!e.message?.includes('cancelled')) {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg }]}>

      {/* Back / close button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={Colors.text.secondary} />
      </TouchableOpacity>

      {/* Logo area */}
      <View style={styles.logoArea}>
        <View style={styles.logoWrap}>
          <Ionicons name="play-circle" size={48} color={Colors.blue.default} />
        </View>
        <Text style={styles.appName}>VidNotes AI</Text>
        <Text style={styles.tagline}>Sign in to unlock the full experience</Text>
      </View>

      {/* Benefits list */}
      <View style={styles.benefits}>
        {BENEFITS.map((b, i) => (
          <View key={i} style={styles.benefitRow}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name={b.icon} size={18} color={Colors.blue.default} />
            </View>
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={16} color={Colors.red.light} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* CTA buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.btnDisabled]}
          onPress={handleGoogle}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.text.primary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={Colors.text.primary} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={styles.guestBtn}
          onPress={handleGuest}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={styles.guestBtnText}>Continue as Guest</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
          New accounts are created automatically on first sign in.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Layout.screenPadding,
  },
  backBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
    padding: Spacing.xs,
  },
  logoArea: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing['2xl'],
    gap: Spacing.sm,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: Layout.borderRadius.xl,
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 158, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  appName: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: Typography.size.md,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  benefits: {
    gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: 'rgba(74, 158, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: Typography.size.md,
    color: Colors.text.secondary,
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 77, 109, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 109, 0.2)',
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.size.sm,
    color: Colors.red.light,
    flex: 1,
  },
  actions: {
    marginTop: 'auto',
    gap: Spacing.md,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.blue.default,
    paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
    minHeight: 52,
  },
  googleBtnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: Typography.size.sm,
    color: Colors.text.muted,
  },
  guestBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    minHeight: 52,
  },
  guestBtnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    color: Colors.text.secondary,
  },
  disclaimer: {
    fontSize: Typography.size.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
});