import { usePostHog } from 'posthog-react-native'

// All event names in one place
export const Events = {
  NOTE_GENERATED: 'note_generated',
  QUIZ_TAKEN: 'quiz_taken',
  QUIZ_COMPLETED: 'quiz_completed',
  FLASHCARD_SESSION: 'flashcard_session',
  PDF_EXPORTED: 'pdf_exported',
  GUEST_LIMIT_HIT: 'guest_limit_hit',
  GUEST_CONVERTED: 'guest_converted', 
  PLAYLIST_GENERATED: 'playlist_generated',
  CHAT_MESSAGE_SENT: 'chat_message_sent',
  SHARE_CREATED: 'share_created',
  SHARE_IMPORTED: 'share_imported',
} as const