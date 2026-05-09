import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useDailyQuiz } from '@/hooks/useDailyQuiz'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

export default function DailyQuiz() {
  const { state, answer } = useDailyQuiz()

  if (state.status === 'loading') {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={Colors.blue.default} />
      </View>
    )
  }

  if (state.status === 'no_topics' || state.status === 'error') {
    return null // hide widget entirely — no topics or failed silently
  }

  const { question } = state
  const answered = state.status === 'answered'

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.badge}>⚡ Daily Quiz</Text>
        {answered && (
          <Text style={[styles.result, { color: state.correct ? Colors.success : Colors.error }]}>
            {state.correct ? 'Correct! +1 streak' : 'Wrong answer'}
          </Text>
        )}
      </View>

      {/* Question */}
      <Text style={styles.question}>{question.question}</Text>

      {/* Options */}
      <View style={styles.options}>
        {OPTION_KEYS.map((key) => {
          const isCorrect = key === question.correct
          const bg = !answered
            ? Colors.surfaceHigh
            : isCorrect
            ? 'rgba(52, 211, 153, 0.15)'
            : 'rgba(255, 77, 109, 0.1)'

          const borderColor = !answered
            ? Colors.border
            : isCorrect
            ? Colors.success
            : Colors.border

          const textColor = !answered
            ? Colors.text.primary
            : isCorrect
            ? Colors.success
            : Colors.text.muted

          return (
            <Pressable
              key={key}
              onPress={() => !answered && answer(key)}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: bg, borderColor, opacity: pressed && !answered ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.optionKey, { color: isCorrect && answered ? Colors.success : Colors.text.muted }]}>
                {key}
              </Text>
              <Text style={[styles.optionText, { color: textColor }]}>
                {question.options[key]}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Explanation after answer */}
      {answered && question.explanation && (
        <View style={styles.explanation}>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Layout.screenPadding,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.cardPadding,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    color: Colors.blue.light,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.semibold,
  },
  result: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
  },
  question: {
    color: Colors.text.primary,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.semibold,
    lineHeight: 22,
  },
  options: {
    gap: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
  },
  optionKey: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.bold,
    width: 18,
  },
  optionText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    flex: 1,
  },
  explanation: {
    backgroundColor: 'rgba(74, 158, 255, 0.08)',
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.blue.default,
  },
  explanationText: {
    color: Colors.text.secondary,
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    lineHeight: 20,
  },
})