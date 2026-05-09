import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabase';
import { useAuth } from '@/hooks/useAuth';
import { parseApiError, ApiError } from '@/lib/api/errors';
import {
  getGuestSubjects,
  saveGuestSubject,
  deleteGuestSubject,
} from '@/services/storage';
import * as Crypto from 'expo-crypto';

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function useSubjects() {
  const { isGuest, isLoading, user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const fetchSubjects = useCallback(async () => {
    if (isLoading) return;
    setLoading(true);
    try {
      if (isGuest) {
        const data = await getGuestSubjects();
        setSubjects(data);
      } else {
        const { data, error } = await supabase
          .from('subjects')
          .select('id, name, description, created_at')
          .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        setSubjects(data ?? []);
      }
    } catch (e) {
      setApiError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [isGuest, isLoading]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const createSubject = useCallback(async (name: string, description?: string) => {
    if (isGuest) {
      const subject: Subject = {
        id: Crypto.randomUUID(),
        name,
        description: description ?? null,
        created_at: new Date().toISOString(),
      };
      await saveGuestSubject(subject);
      setSubjects(prev => [subject, ...prev]);
      return subject;
    } else {
      const { data, error } = await supabase
        .from('subjects')
        .insert({ name, description, user_id: user?.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setSubjects(prev => [data, ...prev]);
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
    setSubjects(prev => prev.filter(s => s.id !== subjectId));
  }, [isGuest]);

  return {
    subjects,
    loading,
    apiError,
    error: apiError?.userMessage ?? null,
    createSubject,
    deleteSubject,
    refetch: fetchSubjects,
  };
}
