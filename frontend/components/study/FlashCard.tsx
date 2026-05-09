import { TouchableOpacity, Text, StyleSheet, View } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'
import { Flashcard } from '@/lib/api/flashcards'

interface FlashCardProps {
  card: Flashcard
  cardNumber: number
  total: number
  flipped: boolean
  onFlip: () => void
}

export function FlashCard({ card, cardNumber, total, flipped, onFlip }: FlashCardProps) {
  const rotation = useSharedValue(flipped ? 1 : 0)

  // Sync rotation when flipped prop changes (e.g. navigating to next card resets it)
  if (flipped && rotation.value === 0) {
    rotation.value = withTiming(1, { duration: 400 })
  } else if (!flipped && rotation.value === 1) {
    rotation.value = withTiming(0, { duration: 400 })
  }

  const handleFlip = () => {
    rotation.value = withTiming(flipped ? 0 : 1, { duration: 400 })
    onFlip()
  }

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 1], [0, 180], Extrapolation.CLAMP)
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    }
  })

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 1], [180, 360], Extrapolation.CLAMP)
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    }
  })

  return (
    <TouchableOpacity onPress={handleFlip} activeOpacity={0.95} style={styles.wrapper}>
      {/* Front */}
      <Animated.View style={[styles.card, styles.cardFront, frontStyle]}>
        <View style={styles.sideTag}>
          <Text style={styles.sideTagText}>QUESTION</Text>
        </View>
        <Text style={styles.counter}>{cardNumber} / {total}</Text>
        <Text style={styles.frontText}>{card.front}</Text>
        <Text style={styles.tapHint}>Tap to reveal answer</Text>
      </Animated.View>

      {/* Back */}
      <Animated.View style={[styles.card, styles.cardBack, backStyle]}>
        <View style={[styles.sideTag, styles.sideTagBack]}>
          <Text style={[styles.sideTagText, styles.sideTagTextBack]}>ANSWER</Text>
        </View>
        <Text style={styles.counter}>{cardNumber} / {total}</Text>
        <Text style={styles.backText}>{card.back}</Text>
        <Text style={styles.tapHint}>Tap to flip back</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    aspectRatio: 1 / 1.1,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: Layout.borderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardFront: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  cardBack: {
    backgroundColor: 'rgba(52,211,153,0.05)',
    borderColor: 'rgba(52,211,153,0.25)',
  },
  sideTag: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: 'rgba(74,158,255,0.1)',
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  sideTagBack: {
    backgroundColor: 'rgba(52,211,153,0.12)',
  },
  sideTagText: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_700Bold',
    color: Colors.blue.light,
    letterSpacing: 0.8,
  },
  sideTagTextBack: {
    color: Colors.success,
  },
  counter: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
  },
  frontText: {
    fontSize: Typography.size.xl,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 30,
  },
  backText: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 24,
  },
  tapHint: {
    position: 'absolute',
    bottom: Spacing.md,
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
})