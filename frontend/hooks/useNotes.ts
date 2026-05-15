import { useState, useEffect, useCallback } from 'react';
import { generateNotes, generateNotesFromText, getNotes, deleteNote, Note } from '@/lib/api/notes';
import { getGuestNotes, saveGuestNote, deleteGuestNote } from '@/services/storage';
import { useAuth } from '@/hooks/useAuth';
import { useSubjectsTopicsStore } from '@/context/SubjectsTopicsContext';
import { parseApiError, ApiErrorType, ApiError } from '@/lib/api/errors';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/supabase';

const GUEST_PDF_IMPORT_KEY = 'guest:pdf_import_used';

export function useNotes(topicId: string, subjectId?: string) {
  const { isGuest, isLoading: authLoading } = useAuth();
  const { setTopicStatus, fetchTopics } = useSubjectsTopicsStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');

  const fetchNotes = useCallback(async () => {
    if (!topicId || topicId === 'skip') { setLoading(false); return; }
    if (authLoading) return;
    setLoading(true);
    setApiError(null);
    try {
      const data = isGuest ? await getGuestNotes(topicId) : await getNotes(topicId);
      setNotes(data);
    } catch (e) {
      setApiError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [topicId, isGuest, authLoading]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const streamNotes = useCallback(async (url: string, title?: string) => {
    if (authLoading) return;
    setStreaming(true);
    setStreamedContent('');
    setApiError(null);
    // Mark topic as generating in the global store so the notes list
    // shows a loading indicator even if the user navigates back
    if (subjectId && topicId && topicId !== 'skip') {
      setTopicStatus(subjectId, topicId, 'generating');
    }
    try {
      const res = await generateNotes(url, isGuest ? undefined : topicId, title);
      const content = res.content;
      const noteTitle = res.title;
      setStreamedContent(content);
      if (isGuest && content) {
        if (!topicId || topicId === 'skip') return;
        const note = {
          id: Crypto.randomUUID(),
          topic_id: topicId,
          title: noteTitle || title || 'Untitled Note',
          content,
          created_at: new Date().toISOString(),
        };
        await saveGuestNote(note);
      }
      // Auto-rename topic if it was left as a placeholder
      if (!isGuest && noteTitle && noteTitle !== 'Untitled Note' && topicId && topicId !== 'skip') {
        const { data: topic } = await supabase
          .from('topics')
          .select('name')
          .eq('id', topicId)
          .single();
        if (topic && (topic.name === 'Untitled Topic' || topic.name === '')) {
          await supabase.from('topics').update({ name: noteTitle }).eq('id', topicId);
        }
      }
      setStreamedContent('');
      await fetchNotes();
    } catch (e) {
      setApiError(parseApiError(e));
    } finally {
      setStreaming(false);
      if (subjectId && topicId && topicId !== 'skip') {
        setTopicStatus(subjectId, topicId, null);
        // Refresh the store's topic list so SubjectAccordion shows the new note
        fetchTopics(subjectId);
      }
    }
  }, [topicId, subjectId, isGuest, authLoading, fetchNotes, setTopicStatus, fetchTopics]);

  const streamNotesFromText = useCallback(async (sourceText: string, title?: string) => {
    if (authLoading) return;
    if (!topicId || topicId === 'skip') return;

    if (isGuest) {
      const used = await AsyncStorage.getItem(GUEST_PDF_IMPORT_KEY);
      if (used === 'true') {
        setApiError(parseApiError('guest_pdf_limit_reached'));
        return;
      }
    }

    setStreaming(true);
    setStreamedContent('');
    setApiError(null);
    try {
      const res = await generateNotesFromText(sourceText, isGuest ? undefined : topicId, title);
      const content = res.content;
      const noteTitle = res.title;
      setStreamedContent(content);
      if (isGuest && content) {
        const note = {
          id: Crypto.randomUUID(),
          topic_id: topicId,
          title: noteTitle || title || 'Untitled Note',
          content,
          created_at: new Date().toISOString(),
        };
        await saveGuestNote(note);
        await AsyncStorage.setItem(GUEST_PDF_IMPORT_KEY, 'true');
      }
      setStreamedContent('');
      await fetchNotes();
    } catch (e) {
      setApiError(parseApiError(e));
    } finally {
      setStreaming(false);
    }
  }, [topicId, isGuest, authLoading, fetchNotes]);

  const removeNote = useCallback(async (noteId: string) => {
    try {
      if (isGuest) {
        await deleteGuestNote(topicId, noteId);
      } else {
        await deleteNote(noteId);
      }
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (e) {
      setApiError(parseApiError(e));
    }
  }, [topicId, isGuest]);

  return {
    notes,
    loading,
    apiError,
    // convenience shorthands for screens that need them
    error: apiError?.userMessage ?? null,
    isGuestLimitReached: apiError?.type === ApiErrorType.GUEST_LIMIT,
    isGuestPdfLimitReached: apiError?.type === ApiErrorType.GUEST_PDF_LIMIT,
    isAiUnavailable: apiError?.type === ApiErrorType.AI_UNAVAILABLE,
    isTopicFull: apiError?.type === ApiErrorType.TOPIC_FULL,
    streaming,
    streamedContent,
    streamNotes,
    streamNotesFromText,
    removeNote,
    refetch: fetchNotes,
    authLoading,
    clearError: () => setApiError(null),
  };
}