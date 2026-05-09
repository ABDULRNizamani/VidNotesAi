import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, Pressable,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useQuiz } from '@/hooks/useQuiz'
import { useSubjects } from '@/hooks/useSubjects'
import { useTopics } from '@/hooks/useTopics'
import { QuizCard } from '@/components/study/QuizCard'
import { LockedFeature } from '@/components/ui/LockedFeature'
import { useAuth } from '@/hooks/useAuth'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

type Difficulty = 'easy' | 'medium' | 'hard'

// ── Topic picker ──────────────────────────────────────────────────────────────

function TopicPickerModal({
  visible,
  onConfirm,
  onClose,
}: {
  visible: boolean
  onConfirm: (topicIds: string[], difficulty: Difficulty, numQuestions: number) => void
  onClose: () => void
}) {
  const { subjects } = useSubjects()
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [numQuestions, setNumQuestions] = useState(10)
  const { topics } = useTopics(expandedSubject ?? 'skip')

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
  const QUESTION_COUNTS = [5, 10, 15, 20]

  const difficultyColor: Record<Difficulty, string> = {
    easy: Colors.success,
    medium: Colors.warning,
    hard: Colors.red.default,
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Configure Quiz</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
            {/* Topics */}
            <Text style={styles.sectionLabel}>Select Topics</Text>
            {subjects.length === 0 ? (
              <Text style={styles.emptyHint}>No subjects yet — generate some notes first.</Text>
            ) : subjects.map(subject => (
              <View key={subject.id}>
                <TouchableOpacity
                  style={styles.subjectRow}
                  onPress={() => setExpandedSubject(
                    expandedSubject === subject.id ? null : subject.id
                  )}
                  activeOpacity={0.75}
                >
                  <Text style={styles.subjectName}>{subject.name}</Text>
                  <Ionicons
                    name={expandedSubject === subject.id ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.text.muted}
                  />
                </TouchableOpacity>

                {expandedSubject === subject.id && topics.map(topic => (
                  <TouchableOpacity
                    key={topic.id}
                    style={styles.topicRow}
                    onPress={() => toggleTopic(topic.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.topicName} numberOfLines={1}>{topic.name}</Text>
                    <View style={[
                      styles.checkbox,
                      selectedTopics.has(topic.id) && styles.checkboxSelected,
                    ]}>
                      {selectedTopics.has(topic.id) &&
                        <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Difficulty */}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Difficulty</Text>
            <View style={styles.pillRow}>
              {DIFFICULTIES.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.pill,
                    difficulty === d && { backgroundColor: difficultyColor[d] + '22', borderColor: difficultyColor[d] },
                  ]}
                  onPress={() => setDifficulty(d)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.pillText,
                    difficulty === d && { color: difficultyColor[d] },
                  ]}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Question count */}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Questions</Text>
            <View style={styles.pillRow}>
              {QUESTION_COUNTS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.pill,
                    numQuestions === n && styles.pillSelected,
                  ]}
                  onPress={() => setNumQuestions(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.pillText,
                    numQuestions === n && styles.pillTextSelected,
                  ]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: Spacing.xl }} />
          </ScrollView>

          <TouchableOpacity
            style={[styles.startBtn, selectedTopics.size === 0 && styles.startBtnDisabled]}
            onPress={() => onConfirm(Array.from(selectedTopics), difficulty, numQuestions)}
            disabled={selectedTopics.size === 0}
            activeOpacity={0.85}
          >
            <Ionicons name="flash-outline" size={18} color="#fff" />
            <Text style={styles.startBtnText}>
              Start Quiz · {numQuestions} questions
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Results screen ────────────────────────────────────────────────────────────

function ResultsScreen({
  score,
  total,
  onRetry,
  onNew,
}: {
  score: number
  total: number
  onRetry: () => void
  onNew: () => void
}) {
  const pct = Math.round((score / total) * 100)

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.results}>
      <Text style={styles.resultsLabel}>Quiz Complete</Text>
      <Text style={styles.resultsScore}>{score} / {total}</Text>
      <Text style={styles.resultsPct}>{pct}% correct</Text>

      <View style={styles.resultsActions}>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={18} color={Colors.blue.default} />
          <Text style={styles.retryBtnText}>Retry Quiz</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newBtn} onPress={onNew} activeOpacity={0.8}>
          <Ionicons name="add-outline" size={18} color="#fff" />
          <Text style={styles.newBtnText}>New Quiz</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const insets = useSafeAreaInsets()
  const { isGuest } = useAuth()
  const quiz = useQuiz()
  const [pickerVisible, setPickerVisible] = useState(false)
  const [lastTopicIds, setLastTopicIds] = useState<string[]>([])
  const [lastDifficulty, setLastDifficulty] = useState<Difficulty>('medium')
  const [lastNumQuestions, setLastNumQuestions] = useState(10)
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [showResult, setShowResult] = useState(false)

  if (isGuest) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quiz</Text>
        </View>
        <LockedFeature
          title="Test your knowledge"
          message="Sign in to generate quizzes from your notes and track your progress."
        />
      </View>
    )
  }

  const handleStart = useCallback((
    topicIds: string[],
    difficulty: Difficulty,
    numQuestions: number,
  ) => {
    setPickerVisible(false)
    setLastTopicIds(topicIds)
    setLastDifficulty(difficulty)
    setLastNumQuestions(numQuestions)
    setSelectedAnswer(null)
    setShowResult(false)
    quiz.startQuiz(topicIds, difficulty, numQuestions)
  }, [quiz])

  const handleAnswer = useCallback((option: 'A' | 'B' | 'C' | 'D') => {
    if (showResult) return
    setSelectedAnswer(option)
    setShowResult(true)
  }, [showResult])

  const handleNext = useCallback(() => {
    setSelectedAnswer(null)
    setShowResult(false)
    quiz.answerQuestion(selectedAnswer!)
  }, [quiz, selectedAnswer])

  const handleRetry = useCallback(() => {
    setSelectedAnswer(null)
    setShowResult(false)
    quiz.startQuiz(lastTopicIds, lastDifficulty, lastNumQuestions)
  }, [quiz, lastTopicIds, lastDifficulty, lastNumQuestions])

  const handleNew = useCallback(() => {
    quiz.resetQuiz()
    setPickerVisible(true)
  }, [quiz])

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quiz</Text>
      </View>

      {/* Content */}
      {quiz.status === 'idle' && (
        <View style={styles.idleBody}>
          <View style={styles.idleIconWrap}>
            <Text style={styles.idleIcon}>⚡</Text>
          </View>
          <Text style={styles.idleTitle}>Quiz yourself</Text>
          <Text style={styles.idleDesc}>
            Generate a multiple-choice quiz from your notes and track your progress.
          </Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="flash-outline" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Create Quiz</Text>
          </TouchableOpacity>
        </View>
      )}

      {quiz.status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.blue.default} />
          <Text style={styles.loadingText}>Generating quiz...</Text>
        </View>
      )}

      {quiz.status === 'error' && (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.red.default} />
          <Text style={styles.errorTitle}>Failed to generate quiz</Text>
          <Text style={styles.errorDesc}>{quiz.error}</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.85}>
            <Text style={styles.newBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {quiz.status === 'active' && quiz.currentQuestion && (
        <ScrollView
          contentContainerStyle={[styles.activeScroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${quiz.progress * 100}%` },
              ]}
            />
          </View>

          <QuizCard
            question={quiz.currentQuestion}
            questionNumber={quiz.currentIndex + 1}
            total={quiz.total}
            selectedAnswer={selectedAnswer}
            onAnswer={handleAnswer}
            showResult={showResult}
          />

          {showResult && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>
                  {quiz.currentIndex + 1 >= quiz.total ? 'See Results' : 'Next Question'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      )}

      {quiz.status === 'finished' && (
        <ScrollView
          contentContainerStyle={[styles.activeScroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <ResultsScreen
            score={quiz.score}
            total={quiz.total}
            onRetry={handleRetry}
            onNew={handleNew}
          />
        </ScrollView>
      )}

      <TopicPickerModal
        visible={pickerVisible}
        onConfirm={handleStart}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  headerNewBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.md, paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
  errorTitle: {
    fontSize: Typography.size.lg,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
  },
  errorDesc: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    textAlign: 'center',
  },
  idleBody: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: Spacing.md,
  },
  idleIconWrap: {
    width: 80, height: 80,
    borderRadius: Layout.borderRadius.xl,
    backgroundColor: 'rgba(255,77,109,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  idleIcon: { fontSize: 36 },
  idleTitle: {
    fontSize: Typography.size.xl,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  idleDesc: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  activeScroll: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: Layout.borderRadius.full,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.blue.default,
    borderRadius: Layout.borderRadius.full,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.blue.default,
    paddingVertical: 14,
    borderRadius: Layout.borderRadius.full,
    marginTop: Spacing.sm,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
  },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.blue.default,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Layout.borderRadius.full,
  },
  newBtnText: {
    color: '#fff',
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
  },
  // Results
  results: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  resultsLabel: {
    fontSize: Typography.size['2xl'],
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  resultsScore: {
    fontSize: Typography.size['3xl'],
    fontFamily: 'Inter_700Bold',
    color: Colors.blue.default,
  },
  resultsPct: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
  resultsActions: {
    flexDirection: 'row', gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.blue.default,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderRadius: Layout.borderRadius.full,
  },
  retryBtnText: {
    color: Colors.blue.default,
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
  },
  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Layout.borderRadius.xl,
    borderTopRightRadius: Layout.borderRadius.xl,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: Colors.border,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
  },
  sheetHandle: {
    width: 36, height: 4,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: Typography.size.lg,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  sheetScroll: { maxHeight: 480 },
  sectionLabel: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    marginBottom: Spacing.sm,
  },
  subjectRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Layout.borderRadius.md,
    marginBottom: 2,
  },
  subjectName: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
  },
  topicRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    borderRadius: Layout.borderRadius.md,
    marginBottom: 2,
  },
  topicName: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
  },
  checkbox: {
    width: 22, height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.blue.default,
    borderWidth: 0,
  },
  pillRow: {
    flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Layout.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  pillSelected: {
    backgroundColor: 'rgba(74,158,255,0.12)',
    borderColor: Colors.blue.default,
  },
  pillText: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
  },
  pillTextSelected: {
    color: Colors.blue.default,
    fontFamily: 'Inter_600SemiBold',
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.blue.default,
    paddingVertical: 14,
    borderRadius: Layout.borderRadius.full,
    marginTop: Spacing.sm,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: {
    color: '#fff',
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
  },
})