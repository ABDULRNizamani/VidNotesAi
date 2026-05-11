import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Markdown from 'react-native-markdown-display'
import { useNotes } from '@/hooks/useNotes'
import { ExportPdfButton } from '@/components/notes/ExportPdfButton'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

export default function NoteReaderScreen() {
  const insets = useSafeAreaInsets()
  const { topicId, noteId } = useLocalSearchParams<{ subjectId: string; topicId: string; noteId: string }>()
  const { notes } = useNotes(topicId)

  const note = notes.find(n => n.id === noteId)

  if (!note) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Note</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Note not found.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{note.title || 'Note'}</Text>
        <ExportPdfButton noteIds={[note.id]} topicId={topicId} variant="icon" />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Markdown style={markdownStyles}>{note.content}</Markdown>
      </ScrollView>
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
    flex: 1,
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 120,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.text.muted, fontFamily: Typography.family.regular },
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
