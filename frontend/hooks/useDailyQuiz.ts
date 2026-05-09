import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabase';
import { useAuth } from '@/hooks/useAuth';
import { generateDailyQuiz, QuizQuestion } from '@/lib/api/quiz';
import { collectSupabaseStreak } from '@/hooks/useStreak';
import { parseApiError } from '@/lib/api/errors';

export type DailyQuizState =
  | { status: 'loading' }
  | { status: 'no_topics' }
  | { status: 'ready'; question: QuizQuestion; dailyQuizId: string }
  | { status: 'answered'; correct: boolean; question: QuizQuestion }
  | { status: 'error'; message: string };

function localDateString() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useDailyQuiz() {
  const { user, isGuest } = useAuth();
  const [state, setState] = useState<DailyQuizState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (isGuest || !user) { setState({ status: 'no_topics' }); return; }
    setState({ status: 'loading' });
    const today = localDateString();

    try {
      const { data: existing } = await supabase
        .from('daily_quizzes')
        .select('id, answered, correct, quiz_id')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        const { data: quiz } = await supabase
          .from('quizzes')
          .select('questions')
          .eq('id', existing.quiz_id)
          .single();
        const question: QuizQuestion = quiz?.questions?.[0];
        if (question) {
          setState(existing.answered
            ? { status: 'answered', correct: existing.correct!, question }
            : { status: 'ready', question, dailyQuizId: existing.id });
          return;
        }
      }

      let result;
      try {
        result = await generateDailyQuiz();
      } catch (e: any) {
      const msg = e?.message ?? ''
      if (msg.includes('already generated')) {
        // backend already has it but our Supabase check missed it — just hide widget
        setState({ status: 'no_topics' })
        return
      }
      if (
        msg.includes('404') ||
        msg.includes('No notes') ||
        msg.includes('no notes') ||
        msg.includes('Not Found') ||
        msg.includes('No subjects')
      ) {
        setState({ status: 'no_topics' })
        return
      }
      throw e
    }

      const { data: dailyRow, error: dailyErr } = await supabase
        .from('daily_quizzes')
        .insert({ user_id: user.id, quiz_id: result.quiz_id, date: today })
        .select('id')
        .single();

      if (dailyErr) {
        console.error('[DailyQuiz] Supabase insert failed:', dailyErr);
        throw new Error(dailyErr.message);
      }
      setState({ status: 'ready', question: result.question, dailyQuizId: dailyRow.id });
    } catch (e) {
      console.error('[DailyQuiz] load failed:', e);
      const err = parseApiError(e);
      setState({ status: 'error', message: err.userMessage });
    }
  }, [user, isGuest]);

  useEffect(() => { load(); }, [load]);

  const answer = useCallback(async (selected: 'A' | 'B' | 'C' | 'D') => {
    if (state.status !== 'ready') return;
    const { question, dailyQuizId } = state;
    const correct = selected === question.correct;
    setState({ status: 'answered', correct, question });
    await supabase.from('daily_quizzes').update({ answered: true, correct }).eq('id', dailyQuizId);
    if (user && correct) {
      const streakState = await collectSupabaseStreak(user.id);
      // streakState is returned if you want to show a milestone animation
    }
  }, [state, user]);

  return { state, answer, retry: load };
}