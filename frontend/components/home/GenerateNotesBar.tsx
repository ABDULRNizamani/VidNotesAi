import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Layout } from '@/constants/layout';

interface GenerateNotesBarProps {
  onPress: () => void;
}

export function GenerateNotesBar({ onPress }: GenerateNotesBarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Generate Notes</Text>
      <Text style={styles.subtitle}>
        Paste a YouTube video or playlist link to get started
      </Text>

      <TouchableOpacity style={styles.bar} onPress={onPress} activeOpacity={0.8}>
        <View style={styles.iconWrap}>
          <Ionicons name="logo-youtube" size={20} color={Colors.red.default} />
        </View>
        <Text style={styles.placeholder}>Paste a YouTube link...</Text>
        <View style={styles.arrowWrap}>
          <Ionicons name="arrow-forward" size={18} color={Colors.text.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.optionRow}>
        <TouchableOpacity style={styles.optionChip} onPress={onPress} activeOpacity={0.75}>
          <Ionicons name="videocam-outline" size={14} color={Colors.blue.default} />
          <Text style={styles.optionText}>Single Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.optionChip} onPress={onPress} activeOpacity={0.75}>
          <Ionicons name="list-outline" size={14} color={Colors.blue.default} />
          <Text style={styles.optionText}>Playlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Layout.screenPadding,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.size.sm,
    color: Colors.text.muted,
    marginTop: -Spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: 'rgba(255,77,109,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    flex: 1,
    fontSize: Typography.size.md,
    color: Colors.text.muted,
  },
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.blue.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(74,158,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  optionText: {
    fontSize: Typography.size.sm,
    color: Colors.blue.default,
    fontWeight: Typography.weight.medium,
  },
});
