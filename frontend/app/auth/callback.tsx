import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/supabase';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function AuthCallback() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/(tabs)');
      } else {
        // Tokens weren't set by the OAuth handler — redirect to login
        router.replace('/auth/login');
      }
    });
  }, []);

  return <LoadingSpinner fullScreen />;
}