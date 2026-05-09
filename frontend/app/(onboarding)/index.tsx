import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ViewToken,
} from 'react-native';
import { useRef, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingSlide, SlideData } from '@/components/onboarding/OnboardingSlide';
import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Layout } from '@/constants/layout';
import { useAuth } from '@/hooks/useAuth';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'vidnotes:onboarding_complete';

const SLIDES: SlideData[] = [
  {
    icon: 'play-circle',
    iconColor: Colors.blue.default,
    iconBg: Colors.card.notes,
    title: 'Welcome to VidNotes AI',
    body: 'Turn any YouTube video or playlist into structured, intelligent study notes — instantly.',
  },
  {
    icon: 'document-text',
    iconColor: Colors.blue.light,
    iconBg: Colors.card.notes,
    title: 'Smart Notes from Any Video',
    body: 'Paste a YouTube link and watch AI generate clean, well-structured notes you can actually study from.',
  },
  {
    icon: 'school',
    iconColor: Colors.red.light,
    iconBg: Colors.card.quiz,
    title: 'Quiz & Flashcards',
    body: 'Test your knowledge with AI-generated quizzes and flashcard drills built directly from your notes.',
  },
  {
    icon: 'chatbubble-ellipses',
    iconColor: '#C084FC',
    iconBg: Colors.card.chatbot,
    title: 'Chat with Your Notes',
    body: 'Ask questions, get explanations, and explore your notes through a smart AI assistant.',
  },
  {
    icon: 'rocket',
    iconColor: Colors.blue.default,
    iconBg: Colors.card.notes,
    title: 'Ready to Learn Smarter?',
    body: 'Sign in to sync your notes across devices, or explore as a guest and sign up later.',
  },
];

async function completeOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { loginWithGoogle } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const isLastSlide = activeIndex === SLIDES.length - 1;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const handleSkip = async () => {
    flatListRef.current?.scrollToIndex({ index: SLIDES.length - 1, animated: true });
  };

  const handleGuest = async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  const handleSignIn = async () => {
    await completeOnboarding();
    try {
      await loginWithGoogle();
      router.replace('/(tabs)');
    } catch {
      // user cancelled — still go to tabs as guest
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Skip button — hidden on last slide */}
      {!isLastSlide && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + Spacing.md }]}
          onPress={handleSkip}
          hitSlop={12}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => <OnboardingSlide slide={item} />}
        style={styles.flatList}
      />

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* Dot indicators */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* CTA buttons */}
        {isLastSlide ? (
          <View style={styles.ctaGroup}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignIn} activeOpacity={0.8}>
              <Ionicons name="logo-google" size={18} color={Colors.text.primary} />
              <Text style={styles.primaryBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostBtn} onPress={handleGuest} activeOpacity={0.8}>
              <Text style={styles.ghostBtnText}>Explore as Guest</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.8}>
            <Ionicons name="arrow-forward" size={22} color={Colors.text.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  skipBtn: {
    position: 'absolute',
    right: Layout.screenPadding,
    zIndex: 10,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  skipText: {
    fontSize: Typography.size.md,
    color: Colors.text.muted,
    fontWeight: Typography.weight.medium,
  },
  flatList: {
    flex: 1,
  },
  bottom: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.borderLight,
  },
  dotActive: {
    width: 22,
    backgroundColor: Colors.blue.default,
  },
  nextBtn: {
    width: 56,
    height: 56,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.blue.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGroup: {
    width: '100%',
    gap: Spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.blue.default,
    paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
  },
  primaryBtnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  ghostBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  ghostBtnText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    color: Colors.text.secondary,
  },
});
