import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native'
import { useState, useCallback } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSubjects } from '@/hooks/useSubjects'
import { useTopics } from '@/hooks/useTopics'
import { SubjectAccordion } from '@/components/notes/SubjectAccordion'
import { GenerateModal } from '@/components/notes/GenerateModal'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { generatePlaylist, PlaylistEvent } from '@/lib/api/playlist'
import { Topic } from '@/hooks/useTopics'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

export default function NotesScreen() {
  const insets = useSafeAreaInsets()
  const { subjects, loading, error: subjectsError, deleteSubject, refetch } = useSubjects()
  const [search, setSearch] = useState('')
  const [generateVisible, setGenerateVisible] = useState(false)
  const [playlistError, setPlaylistError] = useState<string | null>(null)
  const [deleteTopicMeta, setDeleteTopicMeta] = useState<{
    subjectId: string; topicId: string; name: string
  } | null>(null)

  const [activeSubjectId, setActiveSubjectId] = useState('')
  const { deleteTopic } = useTopics(activeSubjectId)

  const [playlistTopics, setPlaylistTopics] = useState<Record<string, Topic[]>>({})
  const [generatingSubjectId, setGeneratingSubjectId] = useState<string | null>(null)

  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleDeleteTopic = (subjectId: string, topicId: string, name: string) => {
    setActiveSubjectId(subjectId)
    setDeleteTopicMeta({ subjectId, topicId, name })
  }

  const confirmDeleteTopic = async () => {
    if (!deleteTopicMeta) return
    await deleteTopic(deleteTopicMeta.topicId)
    setDeleteTopicMeta(null)
    refetch()
  }

  const handleGenerate = (url: string, subjectId: string, topicId: string) => {
    setGenerateVisible(false)
    router.push({
      pathname: '/(tabs)/notes/[subjectId]/[topicId]' as any,
      params: { subjectId, topicId, url },
    })
  }

  const handleGeneratePlaylist = useCallback(async (
    playlistUrl: string,
    subjectId: string,
    videos: { video_id: string; title: string; topic_id: string }[]
  ) => {
    setPlaylistError(null)

    const initialTopics: Topic[] = videos.map(v => ({
      id: v.topic_id,
      subject_id: subjectId,
      name: v.title,
      description: null,
      created_at: new Date().toISOString(),
      generation_status: 'pending',
    }))

    setPlaylistTopics(prev => ({ ...prev, [subjectId]: initialTopics }))
    setGeneratingSubjectId(subjectId)
    await refetch()

    try {
      await generatePlaylist(playlistUrl, subjectId, videos, (event: PlaylistEvent) => {
        if (event.type === 'topic_done') {
          setPlaylistTopics(prev => ({
            ...prev,
            [subjectId]: (prev[subjectId] ?? []).map(t =>
              t.id === event.topic_id ? { ...t, generation_status: 'done' } : t
            ),
          }))
        } else if (event.type === 'topic_failed') {
          setPlaylistTopics(prev => ({
            ...prev,
            [subjectId]: (prev[subjectId] ?? []).map(t =>
              t.id === event.topic_id ? { ...t, generation_status: 'failed' } : t
            ),
          }))
        } else if (event.type === 'playlist_done') {
          setGeneratingSubjectId(null)
          setTimeout(() => {
            setPlaylistTopics(prev => {
              const next = { ...prev }
              delete next[subjectId]
              return next
            })
            refetch()
          }, 3000)
        }
      })
    } catch (e: unknown) {
      setGeneratingSubjectId(null)
      setPlaylistError(e instanceof Error ? e.message : 'Playlist generation failed.')
    }
  }, [refetch])

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notes</Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search subjects..."
          placeholderTextColor={Colors.text.muted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {subjectsError && (
        <ErrorBanner
          message={subjectsError}
          onRetry={refetch}
          onDismiss={() => {}}
        />
      )}

      {playlistError && (
        <ErrorBanner
          message={playlistError}
          onDismiss={() => setPlaylistError(null)}
        />
      )}

      {loading ? null : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to generate your first note from a YouTube video</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          renderItem={({ item }) => (
            <SubjectAccordion
              subject={item}
              onDeleteSubject={deleteSubject}
              onTopicPress={(subjectId, topicId) =>
                router.push({ pathname: '/(tabs)/notes/[subjectId]/[topicId]' as any, params: { subjectId, topicId } })
              }
              onDeleteTopic={handleDeleteTopic}
              forceExpanded={generatingSubjectId === item.id}
              overrideTopics={playlistTopics[item.id]}
            />
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: 100 + insets.bottom }]}
        onPress={() => setGenerateVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <GenerateModal
        visible={generateVisible}
        onClose={() => setGenerateVisible(false)}
        onGenerate={handleGenerate}
        onGeneratePlaylist={handleGeneratePlaylist}
      />

      <DeleteConfirmModal
        visible={!!deleteTopicMeta}
        title="Delete Topic"
        itemName={deleteTopicMeta?.name ?? ''}
        description="This will permanently delete all notes inside this topic."
        onConfirm={confirmDeleteTopic}
        onCancel={() => setDeleteTopicMeta(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Layout.screenPadding, paddingVertical: Spacing.md },
  title: { fontSize: Typography.size['2xl'], fontFamily: Typography.family.bold, color: Colors.text.primary },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: Typography.size.md, fontFamily: Typography.family.regular, color: Colors.text.primary },
  list: { paddingHorizontal: Layout.screenPadding, paddingBottom: 120 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.semibold, color: Colors.text.primary },
  emptySubtitle: { fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: Colors.text.muted, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: Layout.screenPadding,
    width: 56,
    height: 56,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.blue.default,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.blue.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
})