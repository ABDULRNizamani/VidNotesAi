import { Tabs } from 'expo-router';
import { TabBar } from '@/components/layout/TabBar';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { router } from 'expo-router';

export default function TabLayout() {
  const { isGuest, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    // guests can browse but if you want to force login, uncomment:
    // if (isGuest) router.replace('/auth/login');
    
  }, [isGuest, isLoading]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { paddingBottom: 0 } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="chatbot" options={{ title: 'Chat' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
