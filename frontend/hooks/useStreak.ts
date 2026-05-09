import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/supabase'
import { useAuth } from '@/hooks/useAuth'

const AS_KEYS = {
  current:     'guest:streak:current',
  highest:     'guest:streak:highest',
  lastCollect: 'guest:streak:last_collect_date',
  collected:   'guest:streak:collected_today',
}

export interface StreakState {
  current: number
  highest: number
  collectedToday: boolean
  isMilestone: boolean
}

const EMPTY: StreakState = { current: 0, highest: 0, collectedToday: false, isMilestone: false }

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayISO() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isMilestone(n: number) {
  return n > 0 && n % 10 === 0
}

// ── AsyncStorage helpers (guest) ──────────────────────────────────────────────

async function loadGuestStreak(): Promise<StreakState> {
  const [current, highest, lastDate, collectedFlag] = await Promise.all([
    AsyncStorage.getItem(AS_KEYS.current),
    AsyncStorage.getItem(AS_KEYS.highest),
    AsyncStorage.getItem(AS_KEYS.lastCollect),
    AsyncStorage.getItem(AS_KEYS.collected),
  ])

  let currentVal = parseInt(current ?? '0', 10)
  const highestVal = parseInt(highest ?? '0', 10)
  const today = todayISO()
  const yesterday = yesterdayISO()

  // Streak broken — reset
  if (lastDate && lastDate !== today && lastDate !== yesterday) {
    currentVal = 0
    await AsyncStorage.multiSet([[AS_KEYS.current, '0'], [AS_KEYS.collected, '']])
  }

  const collectedToday = lastDate === today && collectedFlag === 'true'
  return { current: currentVal, highest: highestVal, collectedToday, isMilestone: isMilestone(currentVal) }
}

async function collectGuestStreak(): Promise<StreakState> {
  const today = todayISO()
  const yesterday = yesterdayISO()
  const lastDate = await AsyncStorage.getItem(AS_KEYS.lastCollect)

  if (lastDate === today) return loadGuestStreak() // already collected

  const currentRaw = await AsyncStorage.getItem(AS_KEYS.current)
  const highestRaw = await AsyncStorage.getItem(AS_KEYS.highest)

  const current = lastDate === yesterday ? parseInt(currentRaw ?? '0', 10) + 1 : 1
  const highest = Math.max(current, parseInt(highestRaw ?? '0', 10))

  await AsyncStorage.multiSet([
    [AS_KEYS.current,     String(current)],
    [AS_KEYS.highest,     String(highest)],
    [AS_KEYS.lastCollect, today],
    [AS_KEYS.collected,   'true'],
  ])

  return { current, highest, collectedToday: true, isMilestone: isMilestone(current) }
}

// ── Supabase helpers (authenticated) ─────────────────────────────────────────

async function loadSupabaseStreak(userId: string): Promise<StreakState> {
  const today = todayISO()
  const yesterday = yesterdayISO()

  const { data } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, last_active_date, streak_collected_today')
    .eq('id', userId)
    .single()

  if (!data) return EMPTY

  let current = data.current_streak ?? 0
  const highest = data.longest_streak ?? 0
  const last = data.last_active_date

  // Streak broken
  if (last && last !== today && last !== yesterday) {
    current = 0
    await supabase
      .from('profiles')
      .update({ current_streak: 0, streak_collected_today: false })
      .eq('id', userId)
    return { current: 0, highest, collectedToday: false, isMilestone: false }
  }

  const collectedToday = last === today && data.streak_collected_today === true
  return { current, highest, collectedToday, isMilestone: isMilestone(current) }
}

export async function collectSupabaseStreak(userId: string): Promise<StreakState> {
  const today = todayISO()
  const yesterday = yesterdayISO()

  const { data } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, last_active_date, streak_collected_today')
    .eq('id', userId)
    .single()

  if (!data) return EMPTY
  if (data.last_active_date === today && data.streak_collected_today) return loadSupabaseStreak(userId)

  const current = data.last_active_date === yesterday
    ? (data.current_streak ?? 0) + 1
    : 1
  const highest = Math.max(current, data.longest_streak ?? 0)

  await supabase
    .from('profiles')
    .update({
      current_streak: current,
      longest_streak: highest,
      last_active_date: today,
      streak_collected_today: true,
    })
    .eq('id', userId)

  return { current, highest, collectedToday: true, isMilestone: isMilestone(current) }
}

// ── Migration: AsyncStorage → Supabase on login ───────────────────────────────

export async function migrateStreakToSupabase(userId: string) {
  const [current, highest, lastDate] = await Promise.all([
    AsyncStorage.getItem(AS_KEYS.current),
    AsyncStorage.getItem(AS_KEYS.highest),
    AsyncStorage.getItem(AS_KEYS.lastCollect),
  ])

  const currentVal = parseInt(current ?? '0', 10)
  const highestVal = parseInt(highest ?? '0', 10)

  if (currentVal === 0 && highestVal === 0) return // nothing to migrate

  const today = todayISO()
  const yesterday = yesterdayISO()
  const stillValid = lastDate === today || lastDate === yesterday

  await supabase
    .from('profiles')
    .update({
      current_streak:          stillValid ? currentVal : 0,
      longest_streak:          highestVal,
      last_active_date:        stillValid ? lastDate : null,
      streak_collected_today:  lastDate === today,
    })
    .eq('id', userId)

  // Clear AsyncStorage streak keys
  await AsyncStorage.multiRemove(Object.values(AS_KEYS))
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStreak() {
  const { user, isGuest } = useAuth()
  const [streak, setStreak] = useState<StreakState>(EMPTY)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = isGuest || !user
        ? await loadGuestStreak()
        : await loadSupabaseStreak(user.id)
      setStreak(s)
    } finally {
      setLoading(false)
    }
  }, [user, isGuest])

  useEffect(() => {
    load()
  }, [load])

  const collect = useCallback(async () => {
    if (streak.collectedToday) return
    const s = isGuest || !user
      ? await collectGuestStreak()
      : await collectSupabaseStreak(user.id)
    setStreak(s)
  }, [streak.collectedToday, user, isGuest])

  return { streak, loading, collect }
}