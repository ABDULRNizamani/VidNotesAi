/**
 * FirstLaunchCard
 *
 * Shows a dismissible toast-style card the first time the app is opened.
 * Tapping "Read it" navigates to /how-it-works.
 * Persists dismiss state with AsyncStorage so it only shows once.
 */
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

const STORAGE_KEY = '@vidnotes_hiw_seen'
const SHOW_DELAY_MS = 1500

export function FirstLaunchCard() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(120)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'true') return // already seen
      timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    })

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!visible) return
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }, [visible])

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 120,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false))
    AsyncStorage.setItem(STORAGE_KEY, 'true')
  }

  const handleReadIt = () => {
    dismiss()
    // Small delay so card exits before navigation
    setTimeout(() => router.push('/how-it-works'), 120)
  }

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Backdrop tap to dismiss */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
        activeOpacity={1}
      />

      <View style={styles.card}>
        {/* Icon + dismiss */}
        <View style={styles.topRow}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="information-circle"
              size={20}
              color={Colors.blue.default}
            />
          </View>
          <TouchableOpacity onPress={dismiss} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Text */}
        <Text style={styles.title}>First time here?</Text>
        <Text style={styles.body}>
          Learn how notes expire, what limits apply, and how to fix common
          errors before they bite you.
        </Text>

        {/* CTA */}
        <TouchableOpacity
          style={styles.cta}
          onPress={handleReadIt}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>How the app works →</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.blue.default + '44',
    padding: Spacing.md,
    // subtle glow
    shadowColor: Colors.blue.default,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.blue.default + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 2,
  },
  title: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  body: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.blue.default,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Layout.borderRadius.md,
  },
  ctaText: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
})
