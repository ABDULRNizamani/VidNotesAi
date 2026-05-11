import {
  View, Text, FlatList, TouchableOpacity,
  Pressable, Modal, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { ChatBubble } from '@/components/chat/ChatBubble'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatMode } from '@/components/chat/ModeSelector'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import {
  startSession, sendMessage, getHistory, getSessions, updateSessionMode,
  ChatMessage, ChatSession,
} from '@/lib/api/chat'
import { useFakeStream } from '@/hooks/useFakeStream'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/supabase'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'

interface Note {
  id: string
  title: string
  topic_name: string
  subject_name: string
}

interface ActiveSession {
  id: string
  mode: ChatMode
  messages: ChatMessage[]
}

// ── Note picker modal ─────────────────────────────────────────────────────────

function NotePickerModal({
  visible, notes, selectedIds, onToggle, onConfirm, onClose, loading,
}: {
  visible: boolean
  notes: Note[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={() => {}}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Notes</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.pickerSubtitle}>
            Choose which notes the AI can reference in this chat
          </Text>

          {loading ? (
            <View style={styles.pickerLoader}>
              <ActivityIndicator color={Colors.blue.default} />
            </View>
          ) : notes.length === 0 ? (
            <View style={styles.pickerEmpty}>
              <Ionicons name="document-text-outline" size={40} color={Colors.text.muted} />
              <Text style={styles.pickerEmptyTitle}>No notes yet</Text>
              <Text style={styles.pickerEmptyDesc}>
                Generate some notes first, then come back to chat about them.
              </Text>
              <TouchableOpacity
                style={styles.pickerEmptyBtn}
                onPress={() => { onClose(); router.push('/(tabs)/notes') }}
              >
                <Text style={styles.pickerEmptyBtnText}>Go to Notes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                {notes.map(note => {
                  const selected = selectedIds.has(note.id)
                  return (
                    <TouchableOpacity
                      key={note.id}
                      style={[styles.noteRow, selected && styles.noteRowSelected]}
                      onPress={() => onToggle(note.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.noteRowContent}>
                        <Text style={styles.noteTitle} numberOfLines={1}>
                          {note.title || 'Untitled Note'}
                        </Text>
                        <Text style={styles.noteMeta} numberOfLines={1}>
                          {note.subject_name} → {note.topic_name}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
              <TouchableOpacity
                style={[styles.confirmBtn, selectedIds.size === 0 && styles.confirmBtnDisabled]}
                onPress={onConfirm}
                disabled={selectedIds.size === 0}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>
                  Start Chat ({selectedIds.size} note{selectedIds.size !== 1 ? 's' : ''})
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Sessions sidebar ──────────────────────────────────────────────────────────

function SessionsSidebar({
  visible, sessions, activeSessionId, onSelect, onNew, onClose, loading,
}: {
  visible: boolean
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelect: (session: ChatSession) => void
  onNew: () => void
  onClose: () => void
  loading: boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.sidebarOverlay} onPress={onClose}>
        <Pressable style={styles.sidebar} onPress={() => {}}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Chats</Text>
          <TouchableOpacity style={styles.sidebarNewBtn} onPress={onNew} hitSlop={8}>
            <Ionicons name="add" size={20} color={Colors.blue.default} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator color={Colors.blue.default} style={styles.sidebarLoader} />
        ) : sessions.length === 0 ? (
          <Text style={styles.sidebarEmpty}>No chats yet</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {sessions.map(s => {
              const active = activeSessionId === s.id
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sessionRow, active && styles.sessionRowActive]}
                  onPress={() => onSelect(s)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={15}
                    color={active ? Colors.blue.default : Colors.text.muted}
                  />
                  <Text
                    style={[styles.sessionTitle, active && styles.sessionTitleActive]}
                    numberOfLines={1}
                  >
                    {s.title || 'New Chat'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}
      </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChatbotScreen() {
  const insets = useSafeAreaInsets()
  const { isGuest, user } = useAuth()
  const flatListRef = useRef<FlatList>(null)

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [pickerVisible, setPickerVisible] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [pendingMode, setPendingMode] = useState<ChatMode>('explain')

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // fake streaming — holds the latest full assistant reply
  const [latestReply, setLatestReply] = useState<string | null>(null)
  const { displayed: streamedReply, done: streamDone } = useFakeStream(latestReply, {
    charsPerTick: 8,
    intervalMs: 16,
  })

  const loadSessions = useCallback(async () => {
    if (isGuest || !user) return
    setSessionsLoading(true)
    try {
      const res = await getSessions()
      setSessions(res.sessions)
    } catch {
      setLoadError('Failed to load chats.')
    } finally {
      setSessionsLoading(false)
    }
  }, [isGuest, user])

  useEffect(() => { loadSessions() }, [loadSessions])

  const loadNotes = useCallback(async () => {
    if (!user) return
    setNotesLoading(true)
    try {
      const { data, error } = await supabase
        .from('notes')
        .select(`id, title, topics!inner(name, subjects!inner(name))`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      const mapped: Note[] = (data ?? []).map((n: any) => ({
        id: n.id,
        title: n.title,
        topic_name: n.topics?.name ?? '',
        subject_name: n.topics?.subjects?.name ?? '',
      }))
      setNotes(mapped)
    } catch {
      setLoadError('Failed to load notes.')
    } finally {
      setNotesLoading(false)
    }
  }, [user])

  const handleNewChat = useCallback(async (initialMode: ChatMode = 'explain') => {
    setSidebarOpen(false)
    setPendingMode(initialMode)
    setSelectedNoteIds(new Set())
    await loadNotes()
    setPickerVisible(true)
  }, [loadNotes])

  const toggleNote = useCallback((id: string) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleConfirmNotes = useCallback(async () => {
    if (selectedNoteIds.size === 0) return
    setPickerVisible(false)
    setSending(true)
    setError(null)
    try {
      const res = await startSession(Array.from(selectedNoteIds), pendingMode)
      setActiveSession({ id: res.session_id, mode: pendingMode, messages: [] })
      await loadSessions()
    } catch {
      setError('Failed to start session. Please try again.')
    } finally {
      setSending(false)
    }
  }, [selectedNoteIds, pendingMode, loadSessions])

  const handleModeChange = useCallback(async (mode: ChatMode) => {
    if (!activeSession || sending) return
    setActiveSession(prev => prev ? { ...prev, mode } : prev)
    try {
      await updateSessionMode(activeSession.id, mode)
    } catch {
      setError('Failed to update mode.')
    }
  }, [activeSession, sending])

  const handleSelectSession = useCallback(async (session: ChatSession) => {
    setSidebarOpen(false)
    setSending(true)
    setError(null)
    setLatestReply(null)
    try {
      const res = await getHistory(session.id)
      setActiveSession({
        id: session.id,
        mode: session.mode as ChatMode,
        messages: res.messages,
      })
    } catch {
      setError('Failed to load session.')
    } finally {
      setSending(false)
    }
  }, [])

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeSession || sending) return
    const text = input.trim()
    setInput('')
    setError(null)
    setLatestReply(null)

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setActiveSession(prev =>
      prev ? { ...prev, messages: [...prev.messages, userMsg] } : prev
    )
    setSending(true)
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      const res = await sendMessage(activeSession.id, text)
      const data = await res.json()
      // trigger fake stream
      setLatestReply(data.reply)
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      }
      setActiveSession(prev =>
        prev ? { ...prev, messages: [...prev.messages, assistantMsg] } : prev
      )
      loadSessions()
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
      setActiveSession(prev =>
        prev ? { ...prev, messages: prev.messages.slice(0, -1) } : prev
      )
    } finally {
      setSending(false)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150)
    }
  }, [input, activeSession, sending, loadSessions])

  // ── Guest wall ──────────────────────────────────────────────────────────────

  if (isGuest) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <View style={styles.guestBody}>
          <View style={styles.guestIconWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.blue.default} />
          </View>
          <Text style={styles.guestTitle}>Chat about your notes</Text>
          <Text style={styles.guestDesc}>
            Sign in to use the AI tutor — explain concepts, get quizzed, or explore topics Socratically.
          </Text>
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.guestBtnText}>Sign in to unlock</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  const renderEmptyState = () => (
    <View style={styles.emptyBody}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="sparkles-outline" size={28} color={Colors.blue.default} />
      </View>
      <Text style={styles.emptyTitle}>VidNotesAi</Text>
      <Text style={styles.emptyDesc}>
        Ask anything about your notes. I can explain concepts, quiz you, or guide you to answers.
      </Text>
      <View style={styles.modeList}>
        {[
          { mode: 'explain' as ChatMode, icon: 'bulb-outline' as const, label: 'Explain Mode', desc: 'Get clear explanations from your notes' },
          { mode: 'quiz' as ChatMode, icon: 'help-circle-outline' as const, label: 'Quiz Mode', desc: 'Test yourself with adaptive questions' },
          { mode: 'socratic' as ChatMode, icon: 'chatbubbles-outline' as const, label: 'Socratic Mode', desc: 'Discover answers through guided dialogue' },
        ].map(item => (
          <TouchableOpacity
            key={item.mode}
            style={styles.modeCard}
            onPress={() => handleNewChat(item.mode)}
            activeOpacity={0.75}
          >
            <Ionicons name={item.icon} size={20} color={Colors.blue.default} />
            <View style={styles.modeCardText}>
              <Text style={styles.modeCardLabel}>{item.label}</Text>
              <Text style={styles.modeCardDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  // ── Main render ─────────────────────────────────────────────────────────────

  // last message index for fake streaming
  const messages = activeSession?.messages ?? []
  const lastIdx = messages.length - 1

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setSidebarOpen(true)} hitSlop={8}>
          <Ionicons name="menu-outline" size={22} color={Colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerSessionTitle} numberOfLines={1}>
          {activeSession
            ? sessions.find(s => s.id === activeSession.id)?.title || 'New Chat'
            : 'Chat'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.flex}>

        {/* Messages or empty */}
        {!activeSession ? (
          <ScrollView
            contentContainerStyle={styles.emptyScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderEmptyState()}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={[styles.messageList, { paddingBottom: insets.bottom + Layout.bottomTabHeight + Spacing.md + 72 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Text style={styles.emptyMessagesText}>Session started. Send a message to begin.</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              // fake stream only the last assistant message while streaming
              const isLastAssistant =
                item.role === 'assistant' && index === lastIdx && latestReply !== null && !streamDone
              return (
                <ChatBubble
                  role={item.role}
                  content={isLastAssistant ? streamedReply : item.content}
                  isStreaming={isLastAssistant}
                />
              )
            }}
            ListFooterComponent={
              sending && (
                messages.length === 0 ||
                messages[messages.length - 1]?.role === 'user'
              ) ? (
                <View style={styles.thinkingRow}>
                  <View style={styles.thinkingIcon}>
                    <Ionicons name="sparkles-outline" size={13} color={Colors.blue.default} />
                  </View>
                  <View style={styles.thinkingInner}>
                    <ActivityIndicator size="small" color={Colors.text.muted} />
                    <Text style={styles.thinkingText}>Thinking...</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Error banners */}
        {loadError && (
          <ErrorBanner
            message={loadError}
            onRetry={() => { setLoadError(null); loadSessions() }}
            onDismiss={() => setLoadError(null)}
          />
        )}
        {error && (
          <ErrorBanner
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Floating input */}
        {activeSession ? (
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            loading={sending}
            disabled={!activeSession}
            mode={activeSession.mode}
            onModeChange={handleModeChange}
          />
        ) : (
          <View style={[styles.newChatBar, { paddingBottom: insets.bottom + Layout.bottomTabHeight + Spacing.md + Spacing.sm }]}>
            <TouchableOpacity
              style={styles.newChatBtn}
              onPress={() => handleNewChat('explain')}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-outline" size={18} color={Colors.text.muted} />
              <Text style={styles.newChatBtnText}>Start a new chat...</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <SessionsSidebar
        visible={sidebarOpen}
        sessions={sessions}
        activeSessionId={activeSession?.id ?? null}
        onSelect={handleSelectSession}
        onNew={() => handleNewChat()}
        onClose={() => setSidebarOpen(false)}
        loading={sessionsLoading}
      />

      <NotePickerModal
        visible={pickerVisible}
        notes={notes}
        selectedIds={selectedNoteIds}
        onToggle={toggleNote}
        onConfirm={handleConfirmNotes}
        onClose={() => setPickerVisible(false)}
        loading={notesLoading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.family.bold,
    color: Colors.text.primary,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerSessionTitle: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  guestBody: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: Spacing.md,
  },
  guestIconWrap: {
    width: 80, height: 80,
    borderRadius: Layout.borderRadius.xl,
    backgroundColor: 'rgba(74,158,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  guestTitle: {
    fontSize: Typography.size.xl, fontFamily: Typography.family.bold,
    color: Colors.text.primary, textAlign: 'center',
  },
  guestDesc: {
    fontSize: Typography.size.sm, fontFamily: Typography.family.regular,
    color: Colors.text.muted, textAlign: 'center', lineHeight: 20,
  },
  guestBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.blue.default,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
  },
  guestBtnText: { color: '#fff', fontSize: Typography.size.md, fontFamily: Typography.family.semibold },
  emptyScroll: { flexGrow: 1 },
  emptyBody: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 48, paddingBottom: Spacing.lg,
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(74,158,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.size.xl, fontFamily: Typography.family.bold,
    color: Colors.text.primary, marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: Typography.size.sm, fontFamily: Typography.family.regular,
    color: Colors.text.muted, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg,
  },
  modeList: { width: '100%', gap: Spacing.sm },
  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Layout.borderRadius.lg, padding: Layout.cardPadding,
  },
  modeCardText: { flex: 1 },
  modeCardLabel: {
    fontSize: Typography.size.md, fontFamily: Typography.family.semibold,
    color: Colors.text.primary, marginBottom: 2,
  },
  modeCardDesc: {
    fontSize: Typography.size.sm, fontFamily: Typography.family.regular,
    color: Colors.text.muted,
  },
  messageList: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  emptyMessages: { alignItems: 'center', paddingVertical: Spacing.lg },
  emptyMessagesText: {
    fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: Colors.text.muted,
  },
  thinkingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  thinkingIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(74,158,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.25)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  thinkingInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  thinkingText: {
    fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: Colors.text.muted,
  },
  newChatBar: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background,
  },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  newChatBtnText: {
    fontSize: Typography.size.md, fontFamily: Typography.family.regular, color: Colors.text.muted,
  },
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row',
  },
  sidebar: {
    width: 280, height: '100%',
    backgroundColor: Colors.surface,
    borderRightWidth: 1, borderRightColor: Colors.border,
    paddingTop: 60, paddingHorizontal: Spacing.md,
  },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.md,
  },
  sidebarTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.text.primary },
  sidebarNewBtn: {
    width: 32, height: 32, borderRadius: Layout.borderRadius.md,
    backgroundColor: 'rgba(74,158,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  sidebarLoader: { marginTop: Spacing.lg },
  sidebarEmpty: {
    fontSize: Typography.size.sm, fontFamily: Typography.family.regular,
    color: Colors.text.muted, textAlign: 'center', marginTop: Spacing.lg,
  },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.sm,
    borderRadius: Layout.borderRadius.md, marginBottom: 2,
  },
  sessionRowActive: { backgroundColor: 'rgba(74,158,255,0.1)' },
  sessionTitle: {
    flex: 1, fontSize: Typography.size.sm,
    fontFamily: Typography.family.regular, color: Colors.text.secondary,
  },
  sessionTitleActive: { fontFamily: Typography.family.medium, color: Colors.text.primary },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Layout.borderRadius.xl, borderTopRightRadius: Layout.borderRadius.xl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border,
    paddingTop: Spacing.sm, paddingHorizontal: Spacing.md,
    maxHeight: '80%', paddingBottom: Spacing.xl,
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  pickerTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.text.primary },
  pickerSubtitle: {
    fontSize: Typography.size.sm, fontFamily: Typography.family.regular,
    color: Colors.text.muted, marginBottom: Spacing.sm,
  },
  pickerLoader: { paddingVertical: Spacing.xl, alignItems: 'center' },
  pickerEmpty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  pickerEmptyTitle: { fontSize: Typography.size.lg, fontFamily: Typography.family.semibold, color: Colors.text.primary },
  pickerEmptyDesc: {
    fontSize: Typography.size.sm, fontFamily: Typography.family.regular,
    color: Colors.text.muted, textAlign: 'center', lineHeight: 20,
  },
  pickerEmptyBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.blue.default,
    paddingHorizontal: Spacing.xl, paddingVertical: 10, borderRadius: Layout.borderRadius.full,
  },
  pickerEmptyBtnText: { color: '#fff', fontSize: Typography.size.sm, fontFamily: Typography.family.semibold },
  pickerList: { maxHeight: 380 },
  noteRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: Spacing.sm,
    borderRadius: Layout.borderRadius.md, marginBottom: 2,
  },
  noteRowSelected: { backgroundColor: 'rgba(74,158,255,0.08)' },
  noteRowContent: { flex: 1 },
  noteTitle: { fontSize: Typography.size.md, fontFamily: Typography.family.medium, color: Colors.text.primary, marginBottom: 2 },
  noteMeta: { fontSize: Typography.size.xs, fontFamily: Typography.family.regular, color: Colors.text.muted },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.sm,
  },
  checkboxSelected: { backgroundColor: Colors.blue.default, borderWidth: 0 },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.blue.default,
    paddingVertical: 14, borderRadius: Layout.borderRadius.full, marginTop: Spacing.sm,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontSize: Typography.size.md, fontFamily: Typography.family.semibold },
})