import '../global.css';
import { Stack, usePathname, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/hooks/useAuth';
import { SubjectsTopicsProvider } from '@/context/SubjectsTopicsContext';
import { Colors } from '@/constants/colors';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: 'index',
};

function ScreenTracker() {
  const pathname = usePathname();
  const posthog = usePostHog();
  useEffect(() => {
    posthog?.screen(pathname);
  }, [pathname]);
  return null;
}

function RootLayoutInner() {
  const { isLoading, isAuthenticated } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated && segments.includes('auth')) {
      router.replace('/(tabs)')
    }
  }, [isLoading, isAuthenticated, segments])

  return (
    <>
      <ScreenTracker />
      <Stack>
        <Stack.Screen name="index"          options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)"   options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"         options={{ headerShown: false }} />
        <Stack.Screen name="auth/login"     options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback"  options={{ headerShown: false }} />
        <Stack.Screen name="how-it-works"   options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="modal"          options={{ presentation: 'modal', headerShown: false }} />
      </Stack>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.blue.default} />
        </View>
      )}

      <StatusBar style="light" backgroundColor="transparent" translucent />
    </>
  );
}

export default function RootLayout() {
  return (
    <PostHogProvider
      apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY!}
      options={{ host: 'https://us.i.posthog.com' }}
    >
      <SubjectsTopicsProvider>
        <RootLayoutInner />
      </SubjectsTopicsProvider>
    </PostHogProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
