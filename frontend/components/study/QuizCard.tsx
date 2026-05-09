import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, Easing,
} from 'react-native-reanimated'
import { useEffect } from 'react'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'
import { QuizQuestion } from '@/lib/api/quiz'

interface QuizCardProps {
  question: QuizQuestion
  questionNumber: number
  total: number
  selectedAnswer: 'A' | 'B' | 'C' | 'D' | null
  onAnswer: (option: 'A' | 'B' | 'C' | 'D') => void
  showResult: boolean
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

export function QuizCard({
  question,
  questionNumber,
  total,
  selectedAnswer,
  onAnswer,
  showResult,
}: QuizCardProps) {
  const shake = useSharedValue(0)

  // Shake on wrong answer
  useEffect(() => {
    if (showResult && selectedAnswer && selectedAnswer !== question.correct) {
      shake.value = withSequence(
        withTiming(-8, { duration: 60, easing: Easing.linear }),
        withTiming(8,  { duration: 60, easing: Easing.linear }),
        withTiming(-6, { duration: 60, easing: Easing.linear }),
        withTiming(6,  { duration: 60, easing: Easing.linear }),
        withTiming(0,  { duration: 60, easing: Easing.linear }),
      )
    }
  }, [showResult])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }))

  function getOptionStyle(key: typeof OPTION_KEYS[number]) {
    if (!showResult) {
      return selectedAnswer === key ? styles.optionSelected : styles.option
    }
    if (key === question.correct) return styles.optionCorrect
    if (key === selectedAnswer)   return styles.optionWrong
    return styles.option
  }

  function getOptionTextStyle(key: typeof OPTION_KEYS[number]) {
    if (!showResult) {
      return selectedAnswer === key ? styles.optionTextSelected : styles.optionText
    }
    if (key === question.correct) return styles.optionTextCorrect
    if (key === selectedAnswer)   return styles.optionTextWrong
    return styles.optionText
  }

  function getOptionLabel(key: typeof OPTION_KEYS[number]) {
    if (!showResult) return key
    if (key === question.correct) return '✓'
    if (key === selectedAnswer)   return '✗'
    return key
  }

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Counter */}
      <Text style={styles.counter}>{questionNumber} / {total}</Text>

      {/* Question */}
      <Text style={styles.question}>{question.question}</Text>

      {/* Options */}
      <View style={styles.options}>
        {OPTION_KEYS.map(key => (
          <TouchableOpacity
            key={key}
            style={getOptionStyle(key)}
            onPress={() => !showResult && onAnswer(key)}
            activeOpacity={showResult ? 1 : 0.75}
            disabled={showResult}
          >
            <View style={[
              styles.optionBadge,
              showResult && key === question.correct && styles.optionBadgeCorrect,
              showResult && key === selectedAnswer && key !== question.correct && styles.optionBadgeWrong,
              !showResult && selectedAnswer === key && styles.optionBadgeSelected,
            ]}>
              <Text style={[
                styles.optionBadgeText,
                showResult && key === question.correct && styles.optionBadgeTextCorrect,
                showResult && key === selectedAnswer && key !== question.correct && styles.optionBadgeTextWrong,
                !showResult && selectedAnswer === key && styles.optionBadgeTextSelected,
              ]}>
                {getOptionLabel(key)}
              </Text>
            </View>
            <Text style={getOptionTextStyle(key)} numberOfLines={3}>
              {question.options[key]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Explanation */}
      {showResult && (
        <View style={styles.explanation}>
          <Text style={styles.explanationLabel}>Explanation</Text>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  counter: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  question: {
    fontSize: Typography.size.lg,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
    lineHeight: 26,
  },
  options: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
  },
  optionSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(74,158,255,0.08)',
    borderWidth: 1,
    borderColor: Colors.blue.default,
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
  },
  optionCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
  },
  optionWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderWidth: 1,
    borderColor: Colors.red.default,
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: Layout.borderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionBadgeSelected: {
    backgroundColor: Colors.blue.default,
    borderWidth: 0,
  },
  optionBadgeCorrect: {
    backgroundColor: Colors.success,
    borderWidth: 0,
  },
  optionBadgeWrong: {
    backgroundColor: Colors.red.default,
    borderWidth: 0,
  },
  optionBadgeText: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
  },
  optionBadgeTextSelected: { color: '#fff' },
  optionBadgeTextCorrect:  { color: '#fff' },
  optionBadgeTextWrong:    { color: '#fff' },
  optionText: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  optionTextSelected: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
    lineHeight: 22,
  },
  optionTextCorrect: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: 'Inter_500Medium',
    color: Colors.success,
    lineHeight: 22,
  },
  optionTextWrong: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: 'Inter_500Medium',
    color: Colors.red.light,
    lineHeight: 22,
  },
  explanation: {
    backgroundColor: 'rgba(74,158,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.15)',
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
    gap: 4,
    marginTop: Spacing.xs,
  },
  explanationLabel: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.blue.light,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  explanationText: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 20,
  },
})