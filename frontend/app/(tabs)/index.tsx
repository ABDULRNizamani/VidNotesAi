import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { StreakBanner } from '@/components/home/StreakBanner'
import FeatureGrid from '@/components/home/FeatureGrid'
import DailyQuiz from '@/components/home/DailyQuiz'
import { RecentNotes } from '@/components/home/RecentNotes'
import { GenerateNotesBar } from '@/components/home/GenerateNotesBar'
import { FirstLaunchCard } from '@/components/ui/FirstLaunchCard'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/supabase'
import { Note } from '@/lib/api/notes'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'
import { ErrorBanner } from '@/components/shared/ErrorBanner'

export default function HomeScreen() {
  const { user, isGuest } = useAuth()
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const firstName =
    user?.user_metadata?.full_name?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there'

  const fetchRecentNotes = useCallback(async () => {
    if (isGuest || !user) return
    setFetchError(null)
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, content, status, created_at, updated_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(6)
    if (error) { setFetchError('Failed to load recent notes.'); return }
    setRecentNotes(data ?? [])
  }, [user, isGuest])

  useEffect(() => {
    fetchRecentNotes()
  }, [fetchRecentNotes])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRecentNotes()
    setRefreshing(false)
  }, [fetchRecentNotes])

  const handleNotePress = (note: Note) => {
    router.push(`/(tabs)/notes/${note.id}` as any)
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.blue.default}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/(tabs)/profile' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Streak */}
        <StreakBanner />

        {fetchError && (
          <ErrorBanner
            message={fetchError}
            onRetry={fetchRecentNotes}
            onDismiss={() => setFetchError(null)}
          />
        )}

        {/* Feature grid */}
        <FeatureGrid isGuest={isGuest} />

        {/* Daily quiz — hidden for guests */}
        {!isGuest && <DailyQuiz />}

        {/* Recent notes — hidden for guests or if none yet */}
        {!isGuest && recentNotes.length > 0 && (
          <RecentNotes notes={recentNotes} onPress={handleNotePress} />
        )}

        {/* Generate notes bar */}
        <GenerateNotesBar onPress={() => router.push('/(tabs)/notes' as any)} />

        {/* Guest CTA */}
        {isGuest && (
          <TouchableOpacity
            style={styles.guestCta}
            onPress={() => router.push('/auth/login' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={18} color={Colors.blue.default} />
            <Text style={styles.guestCtaText}>
              Sign in to sync notes, track streaks & unlock all features
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.blue.default} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Only shown once, only on home screen */}
      <FirstLaunchCard />
    </>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Layout.screenPadding,
  },
  greeting: {
    fontSize: Typography.size.sm,
    color: Colors.text.muted,
    fontFamily: Typography.family.regular,
  },
  name: {
    fontSize: Typography.size.xl,
    color: Colors.text.primary,
    fontFamily: Typography.family.bold,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Layout.screenPadding,
    backgroundColor: 'rgba(74,158,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
  },
  guestCtaText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.blue.light,
    fontFamily: Typography.family.medium,
    lineHeight: 18,
  },
})
