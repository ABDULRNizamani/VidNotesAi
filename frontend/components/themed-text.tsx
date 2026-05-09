import { Text, type TextProps, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function ThemedText({ style, ...rest }: TextProps) {
  const colorScheme = useColorScheme();
  const color = colorScheme === 'dark' ? '#fff' : '#000';
  return <Text style={[{ color }, style]} {...rest} />;
}