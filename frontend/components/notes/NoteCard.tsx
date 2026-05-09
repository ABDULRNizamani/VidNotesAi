import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Note } from '@/lib/api/notes'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

interface Props {
  note: Note
  onPress: () => void
  onDelete: () => void
}

export function NoteCard({ note, onPress, onDelete }: Props) {
  const preview = note.content?.replace(/[#*`>\[\]()_~\\-]/g, '').replace(/\n+/g, ' ').trim().slice(0, 100)
  const date = new Date(note.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.iconWrap}>
        <Ionicons name="document-text-outline" size={20} color={Colors.blue.default} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{note.title || 'Untitled Note'}</Text>
        {preview ? <Text style={styles.preview} numberOfLines={2}>{preview}</Text> : null}
        <Text style={styles.date}>{date}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.trash}>
        <Ionicons name="trash-outline" size={16} color={Colors.text.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.card.notes,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 4 },
  title: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.semibold,
    color: Colors.text.primary,
  },
  preview: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.text.muted,
    lineHeight: 18,
  },
  date: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.text.muted,
    marginTop: 2,
  },
  trash: { padding: Spacing.xs },
})