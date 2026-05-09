import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/supabase';
import { signInWithGoogle, signOut as authSignOut } from '@/services/auth';
import { migrateStreakToSupabase } from '@/hooks/useStreak';
import { migrateGuestNotesToSupabase } from '@/services/migration';
import { usePostHog } from 'posthog-react-native';

type AuthState = 'loading' | 'guest' | 'authenticated';

const migratedUsers = new Set<string>();

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AuthState>('loading');
  const posthog = usePostHog();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setState(data.session ? 'authenticated' : 'guest');

      if (data.session?.user) {
        const user = data.session.user;
        posthog?.identify(user.id, {
          ...(user.email && { email: user.email }),
          ...(user.user_metadata?.full_name && { name: user.user_metadata.full_name }),
        });

        if (!migratedUsers.has(user.id)) {
          try {
            await migrateStreakToSupabase(user.id);
            await migrateGuestNotesToSupabase(user.id);
            migratedUsers.add(user.id);
          } catch (e) {
            console.warn('[useAuth] migration failed:', e);
          }
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setState(session ? 'authenticated' : 'guest');

      if (session?.user) {
        const user = session.user;
        posthog?.identify(user.id, {
          ...(user.email && { email: user.email }),
          ...(user.user_metadata?.full_name && { name: user.user_metadata.full_name }),
        });

        if (!migratedUsers.has(user.id)) {
          try {
            await migrateStreakToSupabase(user.id);
            await migrateGuestNotesToSupabase(user.id);
            migratedUsers.add(user.id);
          } catch (e) {
            console.warn('[useAuth] migration failed (onAuthStateChange):', e);
          }
        }
      }

      if (!session) {
        posthog?.reset();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    await signInWithGoogle();
  };

  const logout = async () => {
    await authSignOut();
    setState('guest');
    setSession(null);
  };

  const updateDisplayName = async (name: string) => {
    const previousSession = session;
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name }
    });
    if (error) {
      setSession(previousSession);
      throw new Error(error.message);
    }
    setSession(prev => prev ? {
      ...prev,
      user: {
        ...prev.user,
        user_metadata: { ...prev.user.user_metadata, full_name: name }
      }
    } : null);

    if (session?.user.id) posthog?.identify(session.user.id, { name });

    return data;
  };

  return {
    session,
    user: session?.user ?? null,
    isGuest: state === 'guest',
    isAuthenticated: state === 'authenticated',
    isLoading: state === 'loading',
    loginWithGoogle,
    logout,
    updateDisplayName,
  };
}
