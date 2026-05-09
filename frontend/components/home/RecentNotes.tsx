import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Note } from '@/lib/api/notes';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Layout } from '@/constants/layout';

interface RecentNotesProps {
  notes: Note[];
  onPress: (note: Note) => void;
}

function NoteChip({ note, onPress }: { note: Note; onPress: () => void }) {
  // Show first ~60 chars of content as preview
  const preview = note.content?.replace(/[#*`>\-]/g, '').trim().slice(0, 60);

  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.chipIcon}>
        <Ionicons name="document-text-outline" size={16} color={Colors.blue.default} />
      </View>
      <View style={styles.chipText}>
        <Text style={styles.chipTitle} numberOfLines={1}>
          {note.title || 'Untitled Note'}
        </Text>
        {preview ? (
          <Text style={styles.chipPreview} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function RecentNotes({ notes, onPress }: RecentNotesProps) {
  if (!notes.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Recent Notes</Text>
      <FlatList
        data={notes.slice(0, 6)}
        keyExtractor={n => n.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: Spacing.sm }} />}
        renderItem={({ item }) => (
          <NoteChip note={item} onPress={() => onPress(item)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginHorizontal: Layout.screenPadding,
  },
  list: {
    paddingHorizontal: Layout.screenPadding,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    width: 200,
  },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: Layout.borderRadius.sm,
    backgroundColor: Colors.card.notes,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipText: {
    flex: 1,
    gap: 2,
  },
  chipTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  chipPreview: {
    fontSize: Typography.size.xs,
    color: Colors.text.muted,
  },
});
