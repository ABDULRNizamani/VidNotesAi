import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { useStreak } from '@/hooks/useStreak'
import { supabase } from '@/supabase'
import { Avatar } from '@/components/shared/Avatar'
import { LockedFeature } from '@/components/ui/LockedFeature'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'


interface QuizStats {
  total: number
  totalCorrect: number
  totalWrong: number
}

interface WeakTopic {
  id: string
  name: string
  subject_name: string
  attempts: number
  avg_score: number
}

// Raw shape returned from Supabase quiz_attempts select
// Supabase PostgREST returns joined rows as arrays even for many-to-one relations
interface RawAttempt {
  score: number
  total: number
  quiz_id: string
  quizzes: { topic_id: string }[] | null
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, isGuest, logout, updateDisplayName } = useAuth()
  const { streak, loading: streakLoading } = useStreak()

  const [quizStats, setQuizStats] = useState<QuizStats | null>(null)
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  // Name editing state
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)


  const loadStats = useCallback(async () => {
    if (!user) return
    setStatsLoading(true)
    try {
      const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select('score, total, quiz_id, quizzes(topic_id)')
        .eq('user_id', user.id)

      if (error) throw new Error(error.message)

      if (!attempts || attempts.length === 0) {
        setQuizStats({ total: 0, totalCorrect: 0, totalWrong: 0 })
        setWeakTopics([])
        return
      }

      // Guard against total === 0 before dividing
      const validAttempts = (attempts as RawAttempt[]).filter(a => a.total > 0)

      const totalCorrect = validAttempts.reduce((sum, a) => sum + a.score, 0)
      const totalWrong = validAttempts.reduce((sum, a) => sum + (a.total - a.score), 0)
      setQuizStats({ total: attempts.length, totalCorrect, totalWrong })

      // Build weak topics from topic_id via quizzes join
      const topicMap: Record<string, number[]> = {}
      for (const a of validAttempts) {
        const topicId = a.quizzes?.[0]?.topic_id
        if (!topicId) continue
        if (!topicMap[topicId]) topicMap[topicId] = []
        topicMap[topicId].push(Math.round((a.score / a.total) * 100))
      }

      // Sort worst-first and cap at 5 before fetching topic names
      const weakIds = Object.entries(topicMap)
        .filter(([, s]) => s.reduce((a, b) => a + b, 0) / s.length < 70)
        .map(([id, s]) => ({
          id,
          attempts: s.length,
          avg_score: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
        }))
        .sort((a, b) => a.avg_score - b.avg_score)
        .slice(0, 5)

      if (weakIds.length === 0) {
        setWeakTopics([])
        return
      }

      const { data: topics } = await supabase
        .from('topics')
        .select('id, name, subjects!inner(name)')
        .in('id', weakIds.map(w => w.id))

      setWeakTopics(
        weakIds.map(w => {
          const t = topics?.find(t => t.id === w.id)
          return {
            id: w.id,
            name: t?.name ?? 'Unknown',
            subject_name: (t as any)?.subjects?.name ?? '',
            attempts: w.attempts,
            avg_score: w.avg_score,
          }
        })
      )
    } catch (e: any) {
      console.log('[profile] stats error:', e.message)
    } finally {
      setStatsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleEditName = () => {
    setNameInput(user?.user_metadata?.full_name ?? '')
    setEditingName(true)
  }

  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setSavingName(true)
    try {
      await updateDisplayName(trimmed)
      setEditingName(false)
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          await logout()
          setSigningOut(false)
        },
      },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'You will be signed out and your deletion request will be reviewed manually within 48 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request deletion',
          style: 'destructive',
          onPress: async () => {
            await logout()
          },
        },
      ]
    )
  }

  if (isGuest) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <LockedFeature
          title="Your profile awaits"
          message="Sign in to track your streak, view quiz stats, and see which topics need more attention."
        />
      </View>
    )
  }

  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User'
  const email = user?.email ?? ''

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={statsLoading} onRefresh={loadStats} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Identity */}
        <View style={styles.identitySection}>
          <Avatar name={displayName} size={72} />

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                maxLength={40}
                placeholderTextColor={Colors.text.muted}
              />
              <TouchableOpacity
                onPress={handleSaveName}
                disabled={savingName}
                style={styles.nameSaveBtn}
              >
                {savingName
                  ? <ActivityIndicator size="small" color={Colors.blue.default} />
                  : <Text style={styles.nameSaveBtnText}>Save</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditingName(false)}
                style={styles.nameCancelBtn}
              >
                <Text style={styles.nameCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={handleEditName} activeOpacity={0.7}>
              <Text style={styles.displayName}>{displayName}</Text>
              <Ionicons name="pencil-outline" size={14} color={Colors.text.muted} style={styles.editIcon} />
            </TouchableOpacity>
          )}

          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Streak */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Streak</Text>
          {streakLoading ? (
            <ActivityIndicator color={Colors.blue.default} />
          ) : (
            <View style={styles.row}>
              <StatPill label="Current" value={`${streak.current}`} color={Colors.warning} />
              <View style={styles.rowGap} />
              <StatPill label="Best" value={`${streak.highest}`} color={Colors.blue.default} />
            </View>
          )}
        </View>

        {/* Quiz stats */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Quiz Stats</Text>
          {statsLoading ? (
            <ActivityIndicator color={Colors.blue.default} />
          ) : quizStats?.total === 0 ? (
            <Text style={styles.emptyText}>
              No quizzes taken yet. Head to the Notes tab to generate some.
            </Text>
          ) : (
            <View style={styles.row}>
              <StatPill label="Taken" value={String(quizStats?.total ?? 0)} color={Colors.blue.default} />
              <View style={styles.rowGap} />
              <StatPill label="Correct" value={String(quizStats?.totalCorrect ?? 0)} color={Colors.success} />
              <View style={styles.rowGap} />
              <StatPill label="Wrong" value={String(quizStats?.totalWrong ?? 0)} color={Colors.error} />
            </View>
          )}
        </View>

        {/* Weak topics */}
        {!statsLoading && weakTopics.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Topics to Focus On</Text>
            {weakTopics.map((topic, i) => (
              <View
                key={topic.id}
                style={[styles.weakRow, i < weakTopics.length - 1 && styles.weakRowBorder]}
              >
                <View style={styles.weakRowLeft}>
                  <Text style={styles.weakTopicName} numberOfLines={1}>
                    {topic.name}
                  </Text>
                  <Text style={styles.weakSubjectName}>{topic.subject_name}</Text>
                </View>
                <View style={styles.weakRowRight}>
                  <Text style={styles.weakScore}>{topic.avg_score}%</Text>
                  <Text style={styles.weakAttempts}>{topic.attempts} attempts</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/how-it-works')}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={20} color={Colors.text.secondary} />
            <Text style={styles.actionText}>How the app works</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleSignOut}
            activeOpacity={0.7}
            disabled={signingOut}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.text.secondary} />
            <Text style={styles.actionText}>Sign out</Text>
            {signingOut
              ? <ActivityIndicator size="small" color={Colors.text.muted} />
              : <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
            }
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
            <Text style={[styles.actionText, styles.actionTextDanger]}>Delete account</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

function StatPill({
  label,
  value,
  color = Colors.blue.default,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  identitySection: {
    alignItems: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: 6,
  },
  displayName: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  editIcon: {
    marginTop: 2,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  nameInput: {
    flex: 1,
    fontSize: Typography.size.lg,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.blue.default,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  nameSaveBtn: {
    paddingHorizontal: Spacing.sm,
  },
  nameSaveBtnText: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.blue.default,
  },
  nameCancelBtn: {
    paddingHorizontal: Spacing.sm,
  },
  nameCancelBtnText: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
  email: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    marginTop: 4,
  },
  card: {
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.cardPadding,
  },
  cardLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  rowGap: {
    width: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    lineHeight: 20,
  },
  statPill: {
    flex: 1,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Layout.borderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
  weakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
  },
  weakRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weakRowLeft: {
    flex: 1,
  },
  weakTopicName: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
  },
  weakSubjectName: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    marginTop: 2,
  },
  weakRowRight: {
    alignItems: 'flex-end',
  },
  weakScore: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.red.light,
  },
  weakAttempts: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    marginTop: 2,
  },
  actionsCard: {
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.lg,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  actionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Layout.cardPadding,
  },
  actionText: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
  },
  actionTextDanger: {
    fontFamily: 'Inter_500Medium',
    color: Colors.error,
  },
})
