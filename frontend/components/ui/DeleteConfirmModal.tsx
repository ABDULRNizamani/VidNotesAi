import { View, Text, Modal, StyleSheet, TouchableOpacity, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

interface Props {
  visible: boolean
  title: string
  itemName: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({ visible, title, itemName, description, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <Ionicons name="trash-outline" size={28} color={Colors.red.default} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.nameBox}>
            <Text style={styles.nameText} numberOfLines={2}>{itemName}</Text>
          </View>
          {description && <Text style={styles.description}>{description}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Ionicons name="trash" size={16} color="#fff" />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: 'rgba(255,77,109,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.text.primary,
  },
  nameBox: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nameText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  description: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.text.secondary,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.red.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.semibold,
    color: '#fff',
  },
})