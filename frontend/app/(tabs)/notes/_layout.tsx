import { Stack } from 'expo-router'

export default function NotesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[subjectId]/index" />
      <Stack.Screen name="[subjectId]/[topicId]/index" />
      <Stack.Screen name="[subjectId]/[topicId]/[noteId]" />
    </Stack>
  )
}
