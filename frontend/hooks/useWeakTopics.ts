import { useState, useEffect } from 'react'
import { supabase } from '@/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface WeakTopic {
  id: string
  name: string
  subject_name: string
  avg_score: number
  attempts: number
}

export function useWeakTopics() {
  const { user, isGuest } = useAuth()
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isGuest || !user) {
      setWeakTopics([])
      setLoading(false)
      return
    }

    const fetch = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_weak_topics', {
        p_user_id: user.id,
      })

      if (!error && data) setWeakTopics(data as WeakTopic[])
      setLoading(false)
    }

    fetch()
  }, [user, isGuest])

  return { weakTopics, loading }
}