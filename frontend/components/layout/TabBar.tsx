import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/colors'
import { Layout } from '@/constants/layout'
import { Spacing } from '@/constants/spacing'

const TABS = [
  {
    name: 'index',
    label: 'Home',
    active: 'home',
    inactive: 'home-outline',
  },
  {
    name: 'notes/index',
    label: 'Notes',
    active: 'document-text',
    inactive: 'document-text-outline',
  },
  {
    name: 'chatbot',
    label: 'Chat',
    active: 'chatbubble-ellipses',
    inactive: 'chatbubble-ellipses-outline',
  },
  {
    name: 'profile',
    label: 'Profile',
    active: 'person',
    inactive: 'person-outline',
  },
] as const

export function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.outerWrap, { bottom: insets.bottom + Spacing.md }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {/* Glass background — pointerEvents none so it doesn't block touches */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidBg]} pointerEvents="none" />
        )}

        {/* Border overlay */}
        <View style={styles.pillBorder} pointerEvents="none" />

        {/* Tab buttons */}
        <View style={styles.pillInner}>
          {TABS.map((tab, index) => {
            const focused = state.index === index

            const onPress = () => {
              console.log('TAB PRESSED', tab.name)
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[index].key,
                canPreventDefault: true,
              })
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(state.routes[index].name)
              }
            }

            return (
              <TouchableOpacity
                key={tab.name}
                style={[styles.tabBtn, focused && styles.tabBtnActive]}
                onPress={onPress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={(focused ? tab.active : tab.inactive) as any}
                  size={22}
                  color={focused ? Colors.blue.default : Colors.text.muted}
                />
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
  },
  pill: {
    flexDirection: 'row',
    borderRadius: Layout.borderRadius.full,
    overflow: 'hidden',
    height: 64,
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Layout.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  androidBg: {
    backgroundColor: 'rgba(18, 18, 28, 0.97)',
  },
  pillInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.borderRadius.full,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(74, 158, 255, 0.12)',
  },
})