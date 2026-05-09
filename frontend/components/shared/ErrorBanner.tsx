import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

interface Props {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
}

export function ErrorBanner({ message, onDismiss, onRetry }: Props) {
  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle-outline" size={15} color={Colors.red.light} style={styles.icon} />
      <Text style={styles.message} numberOfLines={3}>{message}</Text>
      <View style={styles.actions}>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} hitSlop={8} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={15} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.sm,
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.2)',
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.sm,
  },
  icon: { flexShrink: 0 },
  message: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.red.light,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  retryBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Layout.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.3)',
  },
  retryText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.semibold,
    color: Colors.red.light,
  },
})