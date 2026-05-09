import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

export type ChatMode = 'explain' | 'quiz' | 'socratic'

const MODES: { id: ChatMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'explain', label: 'Explain',   icon: 'bulb-outline' },
  { id: 'quiz',    label: 'Quiz me',   icon: 'help-circle-outline' },
  { id: 'socratic',label: 'Socratic',  icon: 'chatbubbles-outline' },
]

interface Props {
  selected: ChatMode
  onChange: (mode: ChatMode) => void
  locked?: boolean  // true once session started — no switching
}

export function ModeSelector({ selected, onChange, locked }: Props) {
  return (
    <View style={styles.row}>
      {MODES.map(mode => {
        const active = selected === mode.id
        return (
          <TouchableOpacity
            key={mode.id}
            style={[styles.pill, active && styles.pillActive, locked && !active && styles.pillFaded]}
            onPress={() => !locked && onChange(mode.id)}
            activeOpacity={locked ? 1 : 0.75}
          >
            <Ionicons
              name={mode.icon}
              size={13}
              color={active ? Colors.blue.default : Colors.text.muted}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: 'rgba(74,158,255,0.12)',
    borderColor: Colors.blue.default,
  },
  pillFaded: {
    opacity: 0.35,
  },
  label: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.medium,
    color: Colors.text.muted,
  },
  labelActive: {
    color: Colors.blue.default,
  },
})