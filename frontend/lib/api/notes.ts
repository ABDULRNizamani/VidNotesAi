import { apiPost } from './client';
import { supabase } from '@/supabase';

export interface Note {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface GenerateNotesResponse {
  content: string;
  title: string;
}

// topicId is optional — guests don't have DB topics

export const generateNotes = (url: string, topicId?: string, title?: string) =>
  apiPost<GenerateNotesResponse>('/generate/notes', { url, topic_id: topicId ?? null, title });

// topicId optional — guests don't have DB topics

export const generateNotesFromText = (sourceText: string, topicId?: string, title?: string) =>
  apiPost<GenerateNotesResponse>('/generate/notes/from-text', {
    source_text: sourceText,
    topic_id: topicId ?? null,
    title,
  });

// direct Supabase — RLS handles ownership

export const getNotes = async (topicId: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, content, status, created_at, updated_at')
    .eq('topic_id', topicId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

// direct Supabase — soft delete, RLS handles ownership

export const deleteNote = async (noteId: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .update({ status: 'deleted' })
    .eq('id', noteId);

  if (error) throw new Error(error.message);
};