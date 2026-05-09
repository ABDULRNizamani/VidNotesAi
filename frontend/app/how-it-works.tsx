import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

const SECTIONS = [
  {
    icon: 'time-outline' as const,
    title: 'Notes Expire',
    color: Colors.warning,
    items: [
      'Notes are active for 25 days from generation.',
      'You get a warning at day 22.',
      'Notes are archived at day 25 — you can still read them.',
      'Notes are permanently deleted at day 32.',
      'Regenerate from the same video anytime to reset the timer.',
    ],
  },
  {
    icon: 'layers-outline' as const,
    title: 'Note Limits',
    color: Colors.blue.default,
    items: [
      'Max 7 notes per topic.',
      'Delete old notes to make room for new ones.',
      'Max 10 videos per playlist generation.',
      'Text import capped at 200KB.',
    ],
  },
  {
    icon: 'chatbubble-outline' as const,
    title: 'Chat Sessions',
    color: '#A78BFA',
    items: [
      'Chat sessions are deleted after 9 days.',
      'Start a new session anytime — old ones appear in the sidebar.',
      'Each session is tied to the notes you selected at start.',
      'You can change the chat mode (Explain / Quiz / Socratic) mid-session.',
    ],
  },
  {
    icon: 'flash-outline' as const,
    title: 'Daily Quiz',
    color: Colors.warning,
    items: [
      'One daily quiz per day — resets at midnight UTC.',
      'The question is generated from your weakest topics.',
      "No topics or notes yet? The daily quiz won't appear.",
    ],
  },
  {
    icon: 'document-outline' as const,
    title: 'PDF Export & Import',
    color: Colors.success,
    items: [
      'PDF export: max 5 exports per day, 10 per week.',
      'PDF import: max 10 per day.',
      'Max 20 notes per PDF export.',
      'Scanned PDFs (image-based) cannot be imported — text-based only.',
    ],
  },
  {
    icon: 'speedometer-outline' as const,
    title: 'Rate Limits',
    color: Colors.red.default,
    items: [
      'Max 30 AI requests per 60 seconds per account.',
      'Max 2 simultaneous AI requests per account.',
      'If the AI is busy, wait a moment and retry.',
      "Playlist generation runs separately and won't block other features.",
    ],
  },
  {
    icon: 'person-outline' as const,
    title: 'Guest Limits',
    color: Colors.text.muted,
    items: [
      'Guests can generate up to 3 notes (saved locally).',
      'Quiz, Flashcards, and Chat require an account.',
      'Notes generated as a guest are migrated to your account on sign-in.',
      'Guest notes are stored on your device — clearing app data will lose them.',
    ],
  },
  {
    icon: 'alert-circle-outline' as const,
    title: 'Common Errors & Fixes',
    color: Colors.red.light,
    items: [
      '"No transcript found" — the video has no captions. Try another video.',
      '"Transcripts are disabled" — the creator disabled captions. Try another video.',
      '"Topic is full" — delete a note from that topic first.',
      '"AI is busy" — high traffic. Wait 30 seconds and retry.',
      '"Too many requests" — slow down, wait a minute.',
      '"No internet connection" — check your network and retry.',
      '"Daily quiz already generated" — resets at midnight UTC.',
    ],
  },
]

export default function HowItWorksScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How the App Works</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Read this once so nothing surprises you later.
        </Text>

        {SECTIONS.map((section, i) => (
          <View key={i} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: section.color + '22' },
                ]}
              >
                <Ionicons
                  name={section.icon}
                  size={18}
                  color={section.color}
                />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>

            {section.items.map((item, j) => (
              <View key={j} style={styles.itemRow}>
                <View
                  style={[styles.dot, { backgroundColor: section.color }]}
                />
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={Colors.text.muted}
          />
          <Text style={styles.footerText}>
            Access this anytime from your profile page.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    marginRight: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.size.lg,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: 22,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  intro: {
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    marginBottom: Spacing.xs,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Layout.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: Typography.size.md,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    justifyContent: 'center',
    paddingTop: Spacing.md,
  },
  footerText: {
    fontSize: Typography.size.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
})
