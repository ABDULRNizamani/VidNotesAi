import { apiPost } from './client';

export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardsResponse {
  flashcards: Flashcard[];
  total: number;
}

export const generateFlashcards = (topicIds: string[], numCards: number = 10) =>
  apiPost<FlashcardsResponse>('/generate/flashcards', {
    topic_ids: topicIds,
    num_cards: numCards,
  });