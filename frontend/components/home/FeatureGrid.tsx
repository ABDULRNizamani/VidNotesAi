// components/home/FeatureGrid.tsx
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { BookOpen, Brain, Layers, MessageCircle, Lock } from 'lucide-react-native'
import { Colors } from '@/constants/colors'
import { Layout } from '@/constants/layout'
import { Spacing } from '@/constants/spacing'
import { Typography } from '@/constants/typography'

interface Feature {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  tint: string
  route: string
  guestLocked: boolean
}

const features: Feature[] = [
  {
    id: 'notes',
    label: 'Notes',
    description: 'Generate from any YouTube video',
    icon: <BookOpen size={24} color={Colors.blue.light} />,
    tint: Colors.card.notes,
    route: '/(tabs)/notes',
    guestLocked: false,
  },
  {
    id: 'quiz',
    label: 'Quiz',
    description: 'Test yourself on your notes',
    icon: <Brain size={24} color={Colors.red.light} />,
    tint: Colors.card.quiz,
    route: '/(tabs)/quiz',
    guestLocked: true,
  },
  {
    id: 'flashcards',
    label: 'FlashCards',
    description: 'Drill key concepts fast',
    icon: <Layers size={24} color="#86efac" />,
    tint: Colors.card.flashcards,
    route: '/(tabs)/FlashCards',
    guestLocked: true,
  },
  {
    id: 'chatbot',
    label: 'Chatbot',
    description: 'Ask anything about your notes',
    icon: <MessageCircle size={24} color="#d8b4fe" />,
    tint: Colors.card.chatbot,
    route: '/(tabs)/chatbot',
    guestLocked: true,
  },
]

interface FeatureGridProps {
  isGuest: boolean
}

export default function FeatureGrid({ isGuest }: FeatureGridProps) {
  return (
    <View style={styles.grid}>
      {features.map((feature) => {
        const locked = isGuest && feature.guestLocked

        return (
          <Pressable
            key={feature.id}
            onPress={() => !locked && router.push(feature.route as any)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: feature.tint, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.iconWrap}>{feature.icon}</View>

            <View style={styles.textWrap}>
              <Text style={styles.label}>{feature.label}</Text>
              <Text style={styles.description}>{feature.description}</Text>
            </View>

            {locked && (
              <View style={styles.lockOverlay}>
                <Lock size={18} color={Colors.text.muted} />
                <Text style={styles.lockText}>Sign in to unlock</Text>
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
  },
  card: {
    width: '48%',
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.cardPadding,
    minHeight: 110,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    marginTop: Spacing.sm,
  },
  label: {
    color: Colors.text.primary,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.semibold,
    marginBottom: 2,
  },
  description: {
    color: Colors.text.secondary,
    fontSize: Typography.size.xs,
    lineHeight: 15,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.65)',
    borderRadius: Layout.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  lockText: {
    color: Colors.text.muted,
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
  },
})