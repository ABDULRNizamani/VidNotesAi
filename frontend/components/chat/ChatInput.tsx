import {
  View, TextInput, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Keyboard, Animated,
} from 'react-native'
import { useEffect, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ModeSelector, ChatMode } from '@/components/chat/ModeSelector'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

interface Props {
  value: string
  onChange: (text: string) => void
  onSend: () => void
  loading: boolean
  disabled?: boolean
  mode?: ChatMode
  onModeChange?: (mode: ChatMode) => void
}

export function ChatInput({ value, onChange, onSend, loading, disabled, mode, onModeChange }: Props) {
  const insets = useSafeAreaInsets()
  const canSend = value.trim().length > 0 && !loading && !disabled
  const bottomAnim = useRef(new Animated.Value(0)).current

  const restingBottom = Layout.bottomTabHeight + insets.bottom + Spacing.lg

  useEffect(() => {
    bottomAnim.setValue(restingBottom)
  }, [restingBottom])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(bottomAnim, {
        toValue: e.endCoordinates.height + Spacing.lg,
        duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 150,
        useNativeDriver: false,
      }).start()
    })

    const onHide = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(bottomAnim, {
        toValue: restingBottom,
        duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 150,
        useNativeDriver: false,
      }).start()
    })

    return () => {
      onShow.remove()
      onHide.remove()
    }
  }, [restingBottom])

  return (
    <Animated.View style={[styles.stickyWrapper, { bottom: bottomAnim }]}>
      <View style={styles.container}>
        {mode && onModeChange && (
          <ModeSelector selected={mode} onChange={onModeChange} />
        )}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChange}
            placeholder="Message..."
            placeholderTextColor={Colors.text.muted}
            multiline
            maxLength={4000}
            editable={!disabled}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={canSend ? onSend : undefined}
          />
          <TouchableOpacity
            style={[styles.sendBtn, canSend && styles.sendBtnActive]}
            onPress={onSend}
            disabled={!canSend}
            activeOpacity={0.75}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.blue.default} />
              : <Ionicons name="arrow-up" size={18} color={canSend ? '#fff' : Colors.text.muted} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  stickyWrapper: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
  },
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Layout.borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -2 },
    elevation: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.regular,
    color: Colors.text.primary,
    minHeight: 44,
    maxHeight: 120,
    paddingTop: Platform.OS === 'android' ? 6 : 8,
    paddingBottom: Platform.OS === 'android' ? 6 : 8,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnActive: {
    backgroundColor: Colors.blue.default,
  },
})
