import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { usePdf } from '@/hooks/usePdf'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

interface Props {
  noteIds: string[]
  topicId?: string
  /** 'button' = full pill button (default), 'icon' = icon-only for headers */
  variant?: 'button' | 'icon'
}

export function ExportPdfButton({ noteIds, topicId, variant = 'button' }: Props) {
  const { exportStatus, exportError, exportNotes, resetExport } = usePdf()
  const loading = exportStatus === 'loading'

  const handlePress = async () => {
    if (loading || noteIds.length === 0) return
    if (exportStatus === 'error') { resetExport(); return }
    await exportNotes(noteIds, topicId)
  }

  if (variant === 'icon') {
    return (
      <TouchableOpacity onPress={handlePress} hitSlop={8} disabled={loading}>
        {loading
          ? <ActivityIndicator size="small" color={Colors.text.muted} />
          : <Ionicons
              name={exportStatus === 'error' ? 'alert-circle-outline' : 'download-outline'}
              size={22}
              color={exportStatus === 'error' ? Colors.red.default : Colors.text.secondary}
            />
        }
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnLoading, noteIds.length === 0 && styles.btnDisabled]}
        onPress={handlePress}
        disabled={loading || noteIds.length === 0}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator size="small" color={Colors.blue.default} />
          : <Ionicons
              name="download-outline"
              size={16}
              color={exportStatus === 'error' ? Colors.red.default : Colors.blue.default}
            />
        }
        <Text style={[styles.label, exportStatus === 'error' && styles.labelError]}>
          {loading ? 'Exporting...' : exportStatus === 'done' ? 'Exported!' : exportStatus === 'error' ? 'Retry' : 'Export PDF'}
        </Text>
      </TouchableOpacity>
      {exportStatus === 'error' && exportError && (
        <Text style={styles.errorText} numberOfLines={2}>{exportError}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.blue.default,
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    backgroundColor: 'rgba(74,158,255,0.08)',
    alignSelf: 'flex-start',
  },
  btnLoading: { opacity: 0.7 },
  btnDisabled: { opacity: 0.35 },
  label: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.blue.default,
  },
  labelError: { color: Colors.red.default },
  errorText: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.red.default,
    maxWidth: 260,
  },
})