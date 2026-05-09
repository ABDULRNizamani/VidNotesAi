import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  View, Modal, Pressable,
} from 'react-native'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { usePdf } from '@/hooks/usePdf'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

interface Props {
  /** Called with the extracted text when extraction succeeds */
  onExtracted: (text: string, pages: number) => void
}

export function ImportPdfButton({ onExtracted }: Props) {
  const { extractStatus, extractError, extractText, resetExtract } = usePdf()
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [pendingFile, setPendingFile] = useState<{ uri: string; name: string } | null>(null)
  const loading = extractStatus === 'loading'

  const handlePick = async () => {
    resetExtract()
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const file = result.assets[0]
    setPendingFile({ uri: file.uri, name: file.name ?? 'document.pdf' })
    setConfirmVisible(true)
  }

  const handleConfirm = async () => {
    if (!pendingFile) return
    setConfirmVisible(false)
    const res = await extractText(pendingFile.uri)
    if (res) {
      onExtracted(res.text, res.pages)
    }
    setPendingFile(null)
  }

  const handleCancel = () => {
    setConfirmVisible(false)
    setPendingFile(null)
    resetExtract()
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnLoading]}
        onPress={loading ? undefined : handlePick}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator size="small" color={Colors.success} />
          : <Ionicons name="document-attach-outline" size={16} color={Colors.success} />
        }
        <Text style={styles.label}>
          {loading ? 'Extracting...' : 'Import PDF'}
        </Text>
      </TouchableOpacity>

      {extractStatus === 'error' && extractError && (
        <Text style={styles.errorText}>{extractError}</Text>
      )}

      {/* Confirm dialog */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={handleCancel}>
        <Pressable style={styles.overlay} onPress={handleCancel}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <View style={styles.dialogIconWrap}>
              <Ionicons name="document-text-outline" size={28} color={Colors.success} />
            </View>
            <Text style={styles.dialogTitle}>Import this PDF?</Text>
            <Text style={styles.dialogFile} numberOfLines={2}>{pendingFile?.name}</Text>
            <Text style={styles.dialogDesc}>
              The text will be extracted and passed to the note generator as source material.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.confirmBtnText}>Extract Text</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    backgroundColor: 'rgba(52,211,153,0.08)',
    alignSelf: 'flex-start',
  },
  btnLoading: { opacity: 0.7 },
  label: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.success,
  },
  errorText: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.red.default,
    marginTop: 4,
    maxWidth: 260,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  dialogIconWrap: {
    width: 56, height: 56,
    borderRadius: Layout.borderRadius.lg,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  dialogTitle: {
    fontSize: Typography.size.lg,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  dialogFile: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    textAlign: 'center',
  },
  dialogDesc: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.full,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: Colors.success,
    borderRadius: Layout.borderRadius.full,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
})