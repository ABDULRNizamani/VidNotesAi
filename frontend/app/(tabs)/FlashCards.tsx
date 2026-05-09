import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Pressable, ScrollView,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useFlashcards } from '@/hooks/useFlashCards'
import { useSubjects } from '@/hooks/useSubjects'
import { useTopics } from '@/hooks/useTopics'
import { FlashCard } from '@/components/study/FlashCard'
import { LockedFeature } from '@/components/ui/LockedFeature'
import { useAuth } from '@/hooks/useAuth'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

// ── Topic picker (reuses same pattern as Quiz) ────────────────────────────────

function TopicPickerModal({
  visible,
  onConfirm,
  onClose,
}: {
  visible: boolean
  onConfirm: (topicIds: string[], numCards: number) => void
  onClose: () => void
}) {
  const { subjects } = useSubjects()
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [numCards, setNumCards] = useState(10)
  const { topics } = useTopics(expandedSubject ?? 'skip')

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const CARD_COUNTS = [5, 10, 15, 20]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Create Flashcards</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
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

            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Number of Cards</Text>
            <View style={styles.pillRow}>
              {CARD_COUNTS.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.pill, numCards === n && styles.pillSelected]}
                  onPress={() => setNumCards(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pillText, numCards === n && styles.pillTextSelected]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: Spacing.xl }} />
          </ScrollView>

          <TouchableOpacity
            style={[styles.startBtn, selectedTopics.size === 0 && styles.startBtnDisabled]}
            onPress={() => onConfirm(Array.from(selectedTopics), numCards)}
            disabled={selectedTopics.size === 0}
            activeOpacity={0.85}
          >
            <Ionicons name="layers-outline" size={18} color="#fff" />
            <Text style={styles.startBtnText}>
              Generate {numCards} Cards
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Finished screen ───────────────────────────────────────────────────────────

function FinishedScreen({
  total,
  onRestart,
  onNew,
}: {
  total: number
  onRestart: () => void
  onNew: () => void
}) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.finishedBody}>
      <Text style={styles.finishedTitle}>Deck Complete!</Text>
      <Text style={styles.finishedDesc}>You reviewed all {total} cards.</Text>

      <View style={styles.finishedActions}>
        <TouchableOpacity style={styles.restartBtn} onPress={onRestart} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={18} color={Colors.success} />
          <Text style={styles.restartBtnText}>Review Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newDeckBtn} onPress={onNew} activeOpacity={0.8}>
          <Ionicons name="add-outline" size={18} color="#fff" />
          <Text style={styles.newDeckBtnText}>New Deck</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets()
  const { isGuest } = useAuth()
  const fc = useFlashcards()
  const [pickerVisible, setPickerVisible] = useState(false)
  const [lastTopicIds, setLastTopicIds] = useState<string[]>([])
  const [lastNumCards, setLastNumCards] = useState(10)

  if (isGuest) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Flashcards</Text>
        </View>
        <LockedFeature
          title="Study with flashcards"
          message="Sign in to generate flashcards from your notes and drill with spaced repetition."
        />
      </View>
    )
  }

  const handleStart = useCallback((topicIds: string[], numCards: number) => {
    setPickerVisible(false)
    setLastTopicIds(topicIds)
    setLastNumCards(numCards)
    fc.startSession(topicIds, numCards)
  }, [fc])

  const handleNew = useCallback(() => {
    fc.resetSession()
    setPickerVisible(true)
  }, [fc])

  const handleRestart = useCallback(() => {
    fc.restartSession()
  }, [fc])

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Flashcards</Text>
      </View>

      {/* Idle */}
      {fc.status === 'idle' && (
        <View style={styles.idleBody}>
          <View style={styles.idleIconWrap}>
            <Text style={styles.idleIcon}>🃏</Text>
          </View>
          <Text style={styles.idleTitle}>Flashcard drill</Text>
          <Text style={styles.idleDesc}>
            Generate flashcards from your notes and test your recall with spaced repetition.
          </Text>
          <TouchableOpacity style={styles.newDeckBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.85}>
            <Ionicons name="layers-outline" size={18} color="#fff" />
            <Text style={styles.newDeckBtnText}>Create Deck</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading */}
      {fc.status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.success} />
          <Text style={styles.loadingText}>Generating flashcards...</Text>
        </View>
      )}

      {/* Error */}
      {fc.status === 'error' && (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.red.default} />
          <Text style={styles.errorTitle}>Failed to generate cards</Text>
          <Text style={styles.errorDesc}>{fc.error}</Text>
          <TouchableOpacity style={styles.newDeckBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.85}>
            <Text style={styles.newDeckBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active */}
      {fc.status === 'active' && fc.currentCard && (
        <View style={[styles.activeBody, { paddingBottom: insets.bottom + 100 }]}>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${fc.progress * 100}%` }]} />
          </View>

          {/* Card */}
          <View style={styles.cardWrap}>
            <FlashCard
              card={fc.currentCard}
              cardNumber={fc.currentIndex + 1}
              total={fc.total}
              flipped={fc.flipped}
              onFlip={fc.flipCard}
            />
          </View>

          {/* Navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navBtn, fc.currentIndex === 0 && styles.navBtnDisabled]}
              onPress={fc.prevCard}
              disabled={fc.currentIndex === 0}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={20} color={
                fc.currentIndex === 0 ? Colors.text.muted : Colors.text.secondary
              } />
            </TouchableOpacity>

            <Text style={styles.navHint}>
              {fc.flipped ? 'Swipe to next' : 'Tap card to flip'}
            </Text>

            <TouchableOpacity
              style={styles.navBtn}
              onPress={fc.nextCard}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Finished */}
      {fc.status === 'finished' && (
        <View style={[styles.center, { paddingBottom: insets.bottom }]}>
          <FinishedScreen
            total={fc.total}
            onRestart={handleRestart}
            onNew={handleNew}
          />
        </View>
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
    flexDirection: 'row', alignItems: 'center',
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
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
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
  activeBody: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: Layout.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: Layout.borderRadius.full,
  },
  cardWrap: {
    flex: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  navBtn: {
    width: 44, height: 44,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  navHint: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
  // Finished
  finishedBody: {
    alignItems: 'center', gap: Spacing.sm,
  },
  finishedEmoji: { fontSize: 64 },
  finishedTitle: {
    fontSize: Typography.size['2xl'],
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  finishedDesc: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
  finishedActions: {
    flexDirection: 'row', gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  restartBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.success,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderRadius: Layout.borderRadius.full,
  },
  restartBtnText: {
    color: Colors.success,
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
  },
  newDeckBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Layout.borderRadius.full,
  },
  newDeckBtnText: {
    color: '#fff',
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
  },
  // Modal (shared with quiz screen pattern)
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
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Layout.borderRadius.full,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  pillSelected: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderColor: Colors.success,
  },
  pillText: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
  },
  pillTextSelected: {
    color: Colors.success,
    fontFamily: 'Inter_600SemiBold',
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.success,
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