import { View, type ViewProps } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function ThemedView({ style, ...rest }: ViewProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#151718' : '#fff';
  return <View style={[{ backgroundColor }, style]} {...rest} />;
}