import { apiPost } from './client';

export interface QuizOption {
  A: string;
  B: string;
  C: string;
  D: string;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption;
  correct: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface QuizResponse {
  quiz_id: string;
  questions: QuizQuestion[];
  total: number;
}

export interface DailyQuizResponse {
  quiz_id: string;
  question: QuizQuestion;
}

export const generateQuiz = (
  topicIds: string[],
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  numQuestions: number = 10,
) =>
  apiPost<QuizResponse>('/generate/quiz', {
    topic_ids: topicIds,
    difficulty,
    num_questions: numQuestions,
  });

export const generateDailyQuiz = () =>
  apiPost<DailyQuizResponse>('/generate/daily-quiz');