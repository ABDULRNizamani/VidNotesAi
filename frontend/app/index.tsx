import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = 'vidnotes:onboarding_complete';

export default function Entry() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    (async () => {
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      await SplashScreen.hideAsync();
      if (done) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)');
      }
    })();
  }, [isLoading]);

  return null;
}
