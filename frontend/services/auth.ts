import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectUrl = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) throw new Error(error?.message ?? 'OAuth failed');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type !== 'success') throw new Error('Sign in cancelled');

 const url = (result as any).url;
 const urlObj = new URL(url);
 const hashParams = new URLSearchParams(urlObj.hash.slice(1));
 const queryParams = urlObj.searchParams;
 const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token');
 const refreshToken = hashParams.get('refresh_token') ?? queryParams.get('refresh_token');

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  } else {
    throw new Error('No tokens in callback URL');
  }
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}