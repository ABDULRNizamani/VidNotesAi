import { useState, useCallback } from 'react';
import { generateFlashcards, Flashcard } from '@/lib/api/flashcards';
import { parseApiError, ApiError } from '@/lib/api/errors';

export type FlashcardsStatus = 'idle' | 'loading' | 'active' | 'finished' | 'error';

export function useFlashcards() {
  const [status, setStatus] = useState<FlashcardsStatus>('idle');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const startSession = useCallback(async (topicIds: string[], numCards: number = 10) => {
    setStatus('loading');
    setApiError(null);
    setCurrentIndex(0);
    setFlipped(false);
    setCards([]);
    try {
      const res = await generateFlashcards(topicIds, numCards);
      setCards(res.flashcards);
      setStatus('active');
    } catch (e) {
      setApiError(parseApiError(e));
      setStatus('error');
    }
  }, []);

  const flipCard = useCallback(() => setFlipped(f => !f), []);

  const nextCard = useCallback(() => {
    setFlipped(false);
    setCards(cs => {
      if (currentIndex + 1 >= cs.length) setStatus('finished');
      else setCurrentIndex(i => i + 1);
      return cs;
    });
  }, [currentIndex]);

  const prevCard = useCallback(() => {
    if (currentIndex === 0) return;
    setFlipped(false);
    setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  const resetSession = useCallback(() => {
    setStatus('idle');
    setCards([]);
    setCurrentIndex(0);
    setFlipped(false);
    setApiError(null);
  }, []);

  const restartSession = useCallback(() => {
    setCurrentIndex(0);
    setFlipped(false);
    setStatus('active');
  }, []);

  return {
    status, cards, currentCard: cards[currentIndex] ?? null,
    currentIndex, flipped, total: cards.length,
    progress: cards.length > 0 ? (currentIndex + 1) / cards.length : 0,
    apiError,
    error: apiError?.userMessage ?? null,
    startSession, flipCard, nextCard, prevCard, resetSession, restartSession,
    clearError: () => setApiError(null),
  };
}