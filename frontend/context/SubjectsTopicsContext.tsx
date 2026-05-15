/**
 * SubjectsTopicsContext
 *
 * Single source of truth for subjects and topics across the whole app.
 * Replaces the per-hook local state that was causing stale data in Quiz,
 * Flashcards, and Chatbot screens after a deletion on the Notes screen.
 *
 * Usage:
 *   - Wrap your root layout with <SubjectsTopicsProvider>
 *   - All existing useSubjects() / useTopics() hooks read from this store,
 *     so no other file needs to change its API.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { supabase } from '@/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  getGuestSubjects,
  saveGuestSubject,
  deleteGuestSubject,
  getGuestTopics,
  saveGuestTopic,
  deleteGuestTopic,
} from '@/services/storage';
import * as Crypto from 'expo-crypto';
import { parseApiError, ApiError } from '@/lib/api/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export type TopicGenerationStatus = 'pending' | 'generating' | 'done' | 'failed' | null;

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
  created_at: string;
  generation_status: TopicGenerationStatus;
}

// ─── State & actions 
interface State {
  subjects: Subject[];
  subjectsLoading: boolean;
  subjectsError: ApiError | null;
  // topics keyed by subject_id
  topicsBySubject: Record<string, Topic[]>;
  topicsLoading: Record<string, boolean>;
  topicsError: Record<string, ApiError | null>;
}

type Action =
  | { type: 'SUBJECTS_LOADING' }
  | { type: 'SUBJECTS_LOADED'; payload: Subject[] }
  | { type: 'SUBJECTS_ERROR'; payload: ApiError }
  | { type: 'SUBJECT_ADDED'; payload: Subject }
  | { type: 'SUBJECT_DELETED'; payload: string /* id */ }
  | { type: 'TOPICS_LOADING'; subjectId: string }
  | { type: 'TOPICS_LOADED'; subjectId: string; payload: Topic[] }
  | { type: 'TOPICS_ERROR'; subjectId: string; payload: ApiError }
  | { type: 'TOPIC_ADDED'; payload: Topic }
  | { type: 'TOPIC_DELETED'; subjectId: string; topicId: string }
  | { type: 'TOPIC_MOVED'; fromSubjectId: string; topicId: string }
  | { type: 'TOPIC_STATUS_SET'; topicId: string; subjectId: string; status: TopicGenerationStatus };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SUBJECTS_LOADING':
      return { ...state, subjectsLoading: true, subjectsError: null };
    case 'SUBJECTS_LOADED':
      return { ...state, subjects: action.payload, subjectsLoading: false };
    case 'SUBJECTS_ERROR':
      return { ...state, subjectsError: action.payload, subjectsLoading: false };
    case 'SUBJECT_ADDED':
      return { ...state, subjects: [action.payload, ...state.subjects] };
    case 'SUBJECT_DELETED': {
      // Also wipe cached topics for the deleted subject
      const { [action.payload]: _dropped, ...remainingTopics } = state.topicsBySubject;
      return {
        ...state,
        subjects: state.subjects.filter(s => s.id !== action.payload),
        topicsBySubject: remainingTopics,
      };
    }
    case 'TOPICS_LOADING':
      return {
        ...state,
        topicsLoading: { ...state.topicsLoading, [action.subjectId]: true },
        topicsError: { ...state.topicsError, [action.subjectId]: null },
      };
    case 'TOPICS_LOADED':
      return {
        ...state,
        topicsBySubject: { ...state.topicsBySubject, [action.subjectId]: action.payload },
        topicsLoading: { ...state.topicsLoading, [action.subjectId]: false },
      };
    case 'TOPICS_ERROR':
      return {
        ...state,
        topicsError: { ...state.topicsError, [action.subjectId]: action.payload },
        topicsLoading: { ...state.topicsLoading, [action.subjectId]: false },
      };
    case 'TOPIC_ADDED': {
      const sid = action.payload.subject_id;
      const existing = state.topicsBySubject[sid] ?? [];
      return {
        ...state,
        topicsBySubject: { ...state.topicsBySubject, [sid]: [action.payload, ...existing] },
      };
    }
    case 'TOPIC_DELETED': {
      const list = state.topicsBySubject[action.subjectId] ?? [];
      return {
        ...state,
        topicsBySubject: {
          ...state.topicsBySubject,
          [action.subjectId]: list.filter(t => t.id !== action.topicId),
        },
      };
    }
    case 'TOPIC_MOVED': {
      const list = state.topicsBySubject[action.fromSubjectId] ?? [];
      return {
        ...state,
        topicsBySubject: {
          ...state.topicsBySubject,
          [action.fromSubjectId]: list.filter(t => t.id !== action.topicId),
        },
      };
    }
    case 'TOPIC_STATUS_SET': {
      const list = state.topicsBySubject[action.subjectId] ?? [];
      return {
        ...state,
        topicsBySubject: {
          ...state.topicsBySubject,
          [action.subjectId]: list.map(t =>
            t.id === action.topicId ? { ...t, generation_status: action.status } : t
          ),
        },
      };
    }
    default:
      return state;
  }
}

const initialState: State = {
  subjects: [],
  subjectsLoading: true,
  subjectsError: null,
  topicsBySubject: {},
  topicsLoading: {},
  topicsError: {},
};

// ─── Context 

interface ContextValue {
  state: State;
  // subjects
  fetchSubjects: () => Promise<void>;
  createSubject: (name: string, description?: string) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;
  // topics
  fetchTopics: (subjectId: string) => Promise<void>;
  createTopic: (
    subjectId: string,
    name: string,
    description?: string,
    generationStatus?: TopicGenerationStatus
  ) => Promise<Topic>;
  deleteTopic: (subjectId: string, topicId: string) => Promise<void>;
  moveTopic: (fromSubjectId: string, topicId: string, toSubjectId: string) => Promise<void>;
  setTopicStatus: (subjectId: string, topicId: string, status: TopicGenerationStatus) => void;
}

const SubjectsTopicsContext = createContext<ContextValue | null>(null);

// ─── Provider 

export function SubjectsTopicsProvider({ children }: { children: React.ReactNode }) {
  const { isGuest, isLoading: authLoading, user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const fetchedRef = useRef(false);

  // ── Subjects

  const fetchSubjects = useCallback(async () => {
    if (authLoading) return;
    dispatch({ type: 'SUBJECTS_LOADING' });
    try {
      if (isGuest) {
        const data = await getGuestSubjects();
        dispatch({ type: 'SUBJECTS_LOADED', payload: data });
      } else {
        const { data, error } = await supabase
          .from('subjects')
          .select('id, name, description, created_at')
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        dispatch({ type: 'SUBJECTS_LOADED', payload: data ?? [] });
      }
    } catch (e) {
      dispatch({ type: 'SUBJECTS_ERROR', payload: parseApiError(e) });
    }
  }, [isGuest, authLoading]);

  // Initial load once auth is resolved
  useEffect(() => {
    if (authLoading) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchSubjects();
  }, [authLoading, fetchSubjects]);

  // Re-fetch when auth state changes (login/logout)
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading) return;
    const currentId = user?.id ?? (isGuest ? 'guest' : null);
    if (currentId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentId;
      fetchedRef.current = false;
      fetchSubjects();
    }
  }, [user?.id, isGuest, authLoading, fetchSubjects]);

  const createSubject = useCallback(async (name: string, description?: string): Promise<Subject> => {
    if (isGuest) {
      const subject: Subject = {
        id: Crypto.randomUUID(),
        name,
        description: description ?? null,
        created_at: new Date().toISOString(),
      };
      await saveGuestSubject(subject);
      dispatch({ type: 'SUBJECT_ADDED', payload: subject });
      return subject;
    } else {
      const { data, error } = await supabase
        .from('subjects')
        .insert({ name, description, user_id: user?.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      dispatch({ type: 'SUBJECT_ADDED', payload: data as Subject });
      return data as Subject;
    }
  }, [isGuest, user]);

  const deleteSubject = useCallback(async (subjectId: string) => {
    if (isGuest) {
      await deleteGuestSubject(subjectId);
    } else {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId);
      if (error) throw new Error(error.message);
    }
    // Dispatch BEFORE any awaits — UI updates instantly
    dispatch({ type: 'SUBJECT_DELETED', payload: subjectId });
  }, [isGuest]);

  // ── Topics 

  const fetchTopics = useCallback(async (subjectId: string) => {
    if (authLoading || subjectId === 'skip') return;
    dispatch({ type: 'TOPICS_LOADING', subjectId });
    try {
      if (isGuest) {
        const data = await getGuestTopics(subjectId);
        dispatch({
          type: 'TOPICS_LOADED',
          subjectId,
          payload: data.map((t: Topic) => ({ ...t, generation_status: t.generation_status ?? null })),
        });
      } else {
        const { data, error } = await supabase
          .from('topics')
          .select('id, subject_id, name, description, created_at, generation_status')
          .eq('subject_id', subjectId)
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        dispatch({ type: 'TOPICS_LOADED', subjectId, payload: data ?? [] });
      }
    } catch (e) {
      dispatch({ type: 'TOPICS_ERROR', subjectId, payload: parseApiError(e) });
    }
  }, [isGuest, authLoading]);

  const createTopic = useCallback(async (
    subjectId: string,
    name: string,
    description?: string,
    generationStatus?: TopicGenerationStatus,
  ): Promise<Topic> => {
    if (isGuest) {
      const topic: Topic = {
        id: Crypto.randomUUID(),
        subject_id: subjectId,
        name,
        description: description ?? null,
        created_at: new Date().toISOString(),
        generation_status: generationStatus ?? null,
      };
      await saveGuestTopic(topic);
      dispatch({ type: 'TOPIC_ADDED', payload: topic });
      return topic;
    } else {
      const { data, error } = await supabase
        .from('topics')
        .insert({
          subject_id: subjectId,
          name,
          description,
          ...(generationStatus ? { generation_status: generationStatus } : {}),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      dispatch({ type: 'TOPIC_ADDED', payload: data as Topic });
      return data as Topic;
    }
  }, [isGuest]);

  const deleteTopic = useCallback(async (subjectId: string, topicId: string) => {
    if (isGuest) {
      await deleteGuestTopic(subjectId, topicId);
    } else {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId);
      if (error) throw new Error(error.message);
    }
    dispatch({ type: 'TOPIC_DELETED', subjectId, topicId });
  }, [isGuest]);

  const moveTopic = useCallback(async (fromSubjectId: string, topicId: string, toSubjectId: string) => {
    const topicList = state.topicsBySubject[fromSubjectId] ?? [];
    const topic = topicList.find(t => t.id === topicId);
    if (!topic) throw new Error('Topic not found');

    if (isGuest) {
      await deleteGuestTopic(fromSubjectId, topicId);
      await saveGuestTopic({ ...topic, subject_id: toSubjectId });
    } else {
      const { error } = await supabase
        .from('topics')
        .update({ subject_id: toSubjectId })
        .eq('id', topicId);
      if (error) throw new Error(error.message);
    }
    dispatch({ type: 'TOPIC_MOVED', fromSubjectId, topicId });
  }, [isGuest, state.topicsBySubject]);

  const setTopicStatus = useCallback((subjectId: string, topicId: string, status: TopicGenerationStatus) => {
    dispatch({ type: 'TOPIC_STATUS_SET', subjectId, topicId, status });
  }, []);

  return (
    <SubjectsTopicsContext.Provider value={{
      state,
      fetchSubjects,
      createSubject,
      deleteSubject,
      fetchTopics,
      createTopic,
      deleteTopic,
      moveTopic,
      setTopicStatus,
    }}>
      {children}
    </SubjectsTopicsContext.Provider>
  );
}

// ─── Hook accessor 

export function useSubjectsTopicsStore() {
  const ctx = useContext(SubjectsTopicsContext);
  if (!ctx) throw new Error('useSubjectsTopicsStore must be used inside SubjectsTopicsProvider');
  return ctx;
}
