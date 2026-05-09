import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';

const ONBOARDING_KEY = 'vidnotes:onboarding_complete';

export default function Entry() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    (async () => {
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (done) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)');
      }
    })();
  }, [isLoading]);

  return <LoadingSpinner fullScreen />;
}