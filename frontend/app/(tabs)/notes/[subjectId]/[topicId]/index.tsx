import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
} from 'react-native'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Markdown from 'react-native-markdown-display'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, interpolate, Easing,
} from 'react-native-reanimated'
import { useNotes } from '@/hooks/useNotes'
import { usePdf } from '@/hooks/usePdf'
import { NoteCard } from '@/components/notes/NoteCard'
import { GenerateModal } from '@/components/notes/GenerateModal'
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal'
import { ExportPdfButton } from '@/components/notes/ExportPdfButton'
import { ImportPdfButton } from '@/components/notes/ImportPdfButton'
import { generateNotesFromText } from '@/lib/api/notes'
import { Note } from '@/lib/api/notes'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

function SkeletonLine({ width, style }: { width: string | number; style?: object }) {
  const shimmer = useSharedValue(0)

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }))

  return (
    <Animated.View style={[styles.skeletonLine, { width } as any, animStyle, style]} />
  )
}

function SkeletonNotes() {
  return (
    <View style={styles.skeletonWrap}>
      <SkeletonLine width="45%" style={styles.skeletonTitleBar} />
      <View style={{ height: Spacing.lg }} />
      <SkeletonLine width="95%" />
      <SkeletonLine width="88%" />
      <SkeletonLine width="72%" />
      <View style={{ height: Spacing.md }} />
      <SkeletonLine width="55%" style={styles.skeletonSubheading} />
      <SkeletonLine width="93%" />
      <SkeletonLine width="80%" />
      <SkeletonLine width="90%" />
      <SkeletonLine width="65%" />
      <View style={{ height: Spacing.md }} />
      <SkeletonLine width="50%" style={styles.skeletonSubheading} />
      <SkeletonLine width="87%" />
      <SkeletonLine width="78%" />
      <SkeletonLine width="92%" />
    </View>
  )
}

export default function TopicScreen() {
  const insets = useSafeAreaInsets()
  const { subjectId, topicId, url: prefillUrl, pdfText, pdfPages } = useLocalSearchParams<{
    subjectId: string; topicId: string; url?: string; pdfText?: string; pdfPages?: string
  }>()

  const { notes, loading, streaming, streamedContent, streamNotes, removeNote, authLoading, refetch } = useNotes(topicId)
  const { extractStatus, extractError, extractText, resetExtract } = usePdf()

  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)
  const [generateVisible, setGenerateVisible] = useState(false)
  const [pdfStreaming, setPdfStreaming] = useState(false)
  const [pdfStreamedContent, setPdfStreamedContent] = useState('')
  const hasAutoStarted = useRef(false)

  useEffect(() => {
    if (prefillUrl && !hasAutoStarted.current && !authLoading) {
      hasAutoStarted.current = true
      streamNotes(prefillUrl)
    }
  }, [prefillUrl, authLoading])

  useEffect(() => {
    if (pdfText && !hasAutoStarted.current && !authLoading) {
      hasAutoStarted.current = true
      const pages = parseInt(pdfPages ?? '1', 10)
      handlePdfExtracted(pdfText, pages)
    }
  }, [pdfText, authLoading])

  const handleGenerate = async (url: string, _subjectId: string, _topicId: string) => {
    setGenerateVisible(false)
    await streamNotes(url)
  }

  const handleGeneratePdf = useCallback((
    text: string,
    pages: number,
    _subjectId: string,
    _topicId: string,
  ) => {
    // Already on this topic screen — just generate directly
    handlePdfExtracted(text, pages)
  }, [])

  const handlePdfExtracted = async (text: string, pages: number) => {
    setPdfStreaming(true)
    setPdfStreamedContent('')
    try {
      const res = await generateNotesFromText(
        text,
        topicId,
        `PDF Notes (${pages} page${pages !== 1 ? 's' : ''})`,
      )
      setPdfStreamedContent(res.content)
      await refetch()
    } catch (e: any) {
      console.error('[handlePdfExtracted]', e.message)
    } finally {
      setPdfStreaming(false)
      setPdfStreamedContent('')
    }
  }


  // ── Streaming view (YouTube) ──────────────────────────────────────────────
  if (streaming) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Generating Notes</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.streamingBanner}>
          <View style={styles.streamingDot} />
          <Text style={styles.streamingText}>
            {streamedContent.length === 0 ? 'Fetching transcript...' : 'Writing notes...'}
          </Text>
        </View>
        {streamedContent.length > 0 ? (
          <ScrollView contentContainerStyle={styles.readerContent} showsVerticalScrollIndicator={false}>
            <Markdown style={markdownStyles}>{streamedContent + ' ▋'}</Markdown>
          </ScrollView>
        ) : (
          <SkeletonNotes />
        )}
      </View>
    )
  }

  // ── Streaming view (PDF) ──────────────────────────────────────────────────
  if (pdfStreaming) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Generating Notes</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={[styles.streamingBanner, styles.streamingBannerPdf]}>
          <View style={[styles.streamingDot, styles.streamingDotPdf]} />
          <Text style={[styles.streamingText, styles.streamingTextPdf]}>
            Reading PDF and writing notes...
          </Text>
        </View>
        {pdfStreamedContent.length > 0 ? (
          <ScrollView contentContainerStyle={styles.readerContent} showsVerticalScrollIndicator={false}>
            <Markdown style={markdownStyles}>{pdfStreamedContent + ' ▋'}</Markdown>
          </ScrollView>
        ) : (
          <SkeletonNotes />
        )}
      </View>
    )
  }

  // ── Notes list ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Notes</Text>
        <ExportPdfButton
          noteIds={notes.map(n => n.id)}
          topicId={topicId}
          variant="icon"
        />
      </View>

      {loading ? (
        <SkeletonNotes />
      ) : notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap + to generate notes from a YouTube video or import a PDF
          </Text>
          <ImportPdfButton onExtracted={handlePdfExtracted} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListFooterComponent={
            <View style={styles.importRow}>
              <ImportPdfButton onExtracted={handlePdfExtracted} />
            </View>
          }
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => router.push({
                pathname: '/(tabs)/notes/[subjectId]/[topicId]/[noteId]' as any,
                params: { subjectId, topicId, noteId: item.id },
              })}
              onDelete={() => setNoteToDelete(item)}
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
        onGeneratePdf={handleGeneratePdf}
        prefillUrl={prefillUrl}
      />

      <DeleteConfirmModal
        visible={!!noteToDelete}
        title="Delete Note"
        itemName={noteToDelete?.title || 'Untitled Note'}
        onConfirm={async () => {
          if (noteToDelete) await removeNote(noteToDelete.id)
          setNoteToDelete(null)
        }}
        onCancel={() => setNoteToDelete(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  streamingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(74,158,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.md,
  },
  streamingBannerPdf: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.2)',
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.blue.default,
  },
  streamingDotPdf: {
    backgroundColor: Colors.success,
  },
  streamingText: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.blue.light,
  },
  streamingTextPdf: {
    color: Colors.success,
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
  },
  skeletonLine: {
    height: 13,
    borderRadius: Layout.borderRadius.sm,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  skeletonTitleBar: {
    height: 20,
    borderRadius: Layout.borderRadius.md,
  },
  skeletonSubheading: {
    height: 16,
    borderRadius: Layout.borderRadius.sm,
  },
  list: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 120,
  },
  readerContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 120,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.semibold,
    color: Colors.text.primary,
  },
  emptySubtitle: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  importRow: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
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

const markdownStyles: any = {
  body: { color: Colors.text.primary, fontFamily: Typography.family.regular, fontSize: Typography.size.md, lineHeight: 24 },
  heading1: { color: Colors.text.primary, fontFamily: Typography.family.bold, fontSize: Typography.size['2xl'], marginBottom: Spacing.md, marginTop: Spacing.lg },
  heading2: { color: Colors.text.primary, fontFamily: Typography.family.bold, fontSize: Typography.size.xl, marginBottom: Spacing.sm, marginTop: Spacing.md },
  heading3: { color: Colors.text.primary, fontFamily: Typography.family.semibold, fontSize: Typography.size.lg, marginBottom: Spacing.sm },
  paragraph: { color: Colors.text.secondary, marginBottom: Spacing.md, lineHeight: 24 },
  bullet_list: { marginBottom: Spacing.md },
  list_item: { color: Colors.text.secondary, lineHeight: 24 },
  code_inline: { backgroundColor: Colors.surfaceHigh, color: Colors.blue.light, fontFamily: 'monospace', paddingHorizontal: 6, borderRadius: 4 },
  fence: { backgroundColor: Colors.surfaceHigh, borderRadius: Layout.borderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  blockquote: { borderLeftWidth: 3, borderLeftColor: Colors.blue.default, paddingLeft: Spacing.md, marginBottom: Spacing.md },
  strong: { fontFamily: Typography.family.bold, color: Colors.text.primary },
  em: { fontStyle: 'italic', color: Colors.text.secondary },
  hr: { backgroundColor: Colors.border, height: 1, marginVertical: Spacing.lg },
}