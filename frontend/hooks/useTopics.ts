import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabase';
import { useAuth } from '@/hooks/useAuth';
import { parseApiError, ApiError } from '@/lib/api/errors';
import {
  getGuestTopics,
  saveGuestTopic,
  deleteGuestTopic,
} from '@/services/storage';
import * as Crypto from 'expo-crypto';

export type TopicGenerationStatus = 'pending' | 'generating' | 'done' | 'failed' | null;

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
  created_at: string;
  generation_status: TopicGenerationStatus;
}

export function useTopics(subjectId: string) {
  const { isGuest, isLoading } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const fetchTopics = useCallback(async () => {
    if (isLoading) return;
    setLoading(true);
    try {
      if (isGuest) {
        const data = await getGuestTopics(subjectId);
        setTopics(data.map((t: Topic) => ({ ...t, generation_status: t.generation_status ?? null })));
      } else {
        const { data, error } = await supabase
          .from('topics')
          .select('id, subject_id, name, description, created_at, generation_status')
          .eq('subject_id', subjectId)
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        setTopics(data ?? []);
      }
    } catch (e) {
      setApiError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [subjectId, isGuest, isLoading]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const createTopic = useCallback(async (
    name: string,
    description?: string,
    generationStatus?: TopicGenerationStatus,
  ) => {
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
      setTopics(prev => [topic, ...prev]);
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
      setTopics(prev => [data, ...prev]);
      return data as Topic;
    }
  }, [subjectId, isGuest]);

  const deleteTopic = useCallback(async (topicId: string) => {
    if (isGuest) {
      await deleteGuestTopic(subjectId, topicId);
    } else {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId);
      if (error) throw new Error(error.message);
    }
    setTopics(prev => prev.filter(t => t.id !== topicId));
  }, [subjectId, isGuest]);

  const moveTopic = useCallback(async (topicId: string, newSubjectId: string) => {
    if (isGuest) {
      const topic = topics.find(t => t.id === topicId);
      if (!topic) throw new Error('Topic not found');
      await deleteGuestTopic(subjectId, topicId);
      await saveGuestTopic({ ...topic, subject_id: newSubjectId });
    } else {
      const { error } = await supabase
        .from('topics')
        .update({ subject_id: newSubjectId })
        .eq('id', topicId);
      if (error) throw new Error(error.message);
    }
    setTopics(prev => prev.filter(t => t.id !== topicId));
  }, [subjectId, isGuest, topics]);

  const setTopicStatus = useCallback((topicId: string, status: TopicGenerationStatus) => {
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, generation_status: status } : t));
  }, []);

  return { topics, loading, apiError, error: apiError?.userMessage ?? null, createTopic, deleteTopic, moveTopic, setTopicStatus, refetch: fetchTopics };
}