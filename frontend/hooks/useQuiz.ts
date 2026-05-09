import { useState, useCallback } from 'react';
import { generateQuiz, QuizQuestion } from '@/lib/api/quiz';
import { supabase } from '@/supabase';
import { useAuth } from '@/hooks/useAuth';
import { parseApiError, ApiError } from '@/lib/api/errors';

export type QuizStatus = 'idle' | 'loading' | 'active' | 'finished' | 'error';

export interface QuizAnswer {
  questionIndex: number;
  selected: 'A' | 'B' | 'C' | 'D';
  correct: boolean;
}

async function saveQuizAttempt(
  quizId: string,
  userId: string,
  answers: QuizAnswer[],
  questions: QuizQuestion[],
) {
  const score = answers.filter(a => a.correct).length;
  const total = questions.length;
  const wrongAnswers = answers
    .filter(a => !a.correct)
    .map(a => ({
      question: questions[a.questionIndex]?.question,
      selected: a.selected,
      correct: questions[a.questionIndex]?.correct,
    }));

  await supabase.from('quiz_attempts').insert({
    quiz_id: quizId,
    user_id: userId,
    score,
    total,
    wrong_answers: wrongAnswers.length > 0 ? wrongAnswers : null,
  });
}

export function useQuiz() {
  const { user } = useAuth();
  const [status, setStatus] = useState<QuizStatus>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);

  const startQuiz = useCallback(async (
    topicIds: string[],
    difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    numQuestions: number = 10,
  ) => {
    setStatus('loading');
    setApiError(null);
    setAnswers([]);
    setCurrentIndex(0);
    setQuestions([]);
    setTopicIds(topicIds);
    setQuizId(null);
    try {
      const res = await generateQuiz(topicIds, difficulty, numQuestions);
      setQuestions(res.questions);
      setQuizId(res.quiz_id ?? null);
      setStatus('active');
    } catch (e) {
      setApiError(parseApiError(e));
      setStatus('error');
    }
  }, []);

  const answerQuestion = useCallback((selected: 'A' | 'B' | 'C' | 'D') => {
    const q = questions[currentIndex];
    if (!q) return;
    const answer: QuizAnswer = {
      questionIndex: currentIndex,
      selected,
      correct: selected === q.correct,
    };
    const next = [...answers, answer];
    setAnswers(next);
    if (currentIndex + 1 >= questions.length) {
      setStatus('finished');
      if (quizId && user) saveQuizAttempt(quizId, user.id, next, questions);
    } else {
      setCurrentIndex(i => i + 1);
    }
  }, [currentIndex, questions, answers, quizId, user]);

  const resetQuiz = useCallback(() => {
    setStatus('idle');
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setApiError(null);
    setQuizId(null);
  }, []);

  const score = answers.filter(a => a.correct).length;
  const total = questions.length;
  const currentQuestion = questions[currentIndex] ?? null;
  const progress = total > 0 ? currentIndex / total : 0;

  return {
    status, questions, currentQuestion, currentIndex,
    answers, score, total, progress,
    apiError,
    error: apiError?.userMessage ?? null,
    startQuiz, answerQuestion, resetQuiz,
    clearError: () => setApiError(null),
  };
}