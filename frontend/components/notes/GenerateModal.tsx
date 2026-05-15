import {
  View, Text, Modal, StyleSheet, TouchableOpacity, TextInput,
  Pressable, ScrollView, ActivityIndicator, Platform,
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { useSubjectsTopicsStore } from '@/context/SubjectsTopicsContext'
import { useAuth } from '@/hooks/useAuth'
import { useNotes } from '@/hooks/useNotes'
import { usePdf } from '@/hooks/usePdf'
import { getPlaylistInfo, PlaylistVideo } from '@/lib/api/playlist'
import { Colors } from '@/constants/colors'
import { Typography } from '@/constants/typography'
import { Spacing } from '@/constants/spacing'
import { Layout } from '@/constants/layout'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'


type Tab = 'video' | 'playlist' | 'pdf'

interface Props {
  visible: boolean
  onClose: () => void
  onGenerate: (url: string, subjectId: string, topicId: string) => void
  onGeneratePlaylist?: (
    playlistUrl: string,
    subjectId: string,
    videos: { video_id: string; title: string; topic_id: string }[]
  ) => void
  onGeneratePdf?: (text: string, pages: number, subjectId: string, topicId: string) => void
  prefillUrl?: string
}

export function GenerateModal({
  visible,
  onClose,
  onGenerate,
  onGeneratePlaylist,
  onGeneratePdf,
  prefillUrl = '',
}: Props) {
  const router = useRouter()
  const { isGuest } = useAuth()
  const [tab, setTab] = useState<Tab>('video')
  const insets = useSafeAreaInsets()

  const { state, createSubject, fetchTopics, createTopic } = useSubjectsTopicsStore()
  const subjects = state.subjects
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newTopicName, setNewTopicName] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)
  const [addingTopic, setAddingTopic] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validationMsg, setValidationMsg] = useState('')

  const topics = state.topicsBySubject[selectedSubjectId ?? ''] ?? []

  // Always re-fetch when subject changes — don't rely on cache
  useEffect(() => {
    if (selectedSubjectId) fetchTopics(selectedSubjectId)
  }, [selectedSubjectId])

  const { isGuestLimitReached } = useNotes(selectedTopicId ?? 'none')

  const [url, setUrl] = useState(prefillUrl)

  const [playlistUrl, setPlaylistUrl] = useState('')
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [playlistError, setPlaylistError] = useState('')
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistVideo[]>([])
  const [playlistTotal, setPlaylistTotal] = useState(0)
  const [playlistCapped, setPlaylistCapped] = useState(false)
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({})
  const [playlistConfirming, setPlaylistConfirming] = useState(false)

  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string } | null>(null)
  const { extractStatus, extractText, extractError, resetExtract } = usePdf()
  const pdfLoading = extractStatus === 'loading'

  const scrollViewRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (visible) setUrl(prefillUrl)
  }, [prefillUrl, visible])

  const reset = () => {
    setTab('video')
    setUrl(prefillUrl)
    setSelectedSubjectId(null)
    setSelectedTopicId(null)
    setNewSubjectName('')
    setNewTopicName('')
    setAddingSubject(false)
    setAddingTopic(false)
    setLoading(false)
    setValidationMsg('')
    setPlaylistUrl('')
    setPlaylistVideos([])
    setPlaylistTotal(0)
    setPlaylistCapped(false)
    setPlaylistError('')
    setEditedTitles({})
    setPlaylistConfirming(false)
    setPdfFile(null)
    resetExtract()
  }

  const handleClose = () => { reset(); onClose() }

  const handleTabChange = (next: Tab) => {
    if (next === tab) return
    setValidationMsg('')
    setPlaylistError('')
    setAddingSubject(false)
    setNewSubjectName('')
    setAddingTopic(false)
    setNewTopicName('')
    setPdfFile(null)
    resetExtract()
    setTab(next)
    scrollViewRef.current?.scrollTo({ y: 0, animated: false })
  }

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return
    const trimmed = newSubjectName.trim()
    const exists = subjects.find(s => s.name.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setSelectedSubjectId(exists.id)
      setSelectedTopicId(null)
      setNewSubjectName('')
      setAddingSubject(false)
      setValidationMsg('')
      return
    }
    setLoading(true)
    try {
      const s = await createSubject(trimmed)
      setSelectedSubjectId(s.id)
      setSelectedTopicId(null)
      setNewSubjectName('')
      setAddingSubject(false)
      setValidationMsg('')
    } catch (e: any) {
      setValidationMsg(e.message ?? 'Failed to create subject')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTopic = async () => {
    if (!newTopicName.trim()) return
    if (!selectedSubjectId) { setValidationMsg('Please select a subject first.'); return }
    const trimmed = newTopicName.trim()
    const exists = topics.find(t => t.name.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setSelectedTopicId(exists.id)
      setNewTopicName('')
      setAddingTopic(false)
      setValidationMsg('')
      return
    }
    setLoading(true)
    try {
      const t = await createTopic(selectedSubjectId, trimmed)
      setSelectedTopicId(t.id)
      setNewTopicName('')
      setAddingTopic(false)
      setValidationMsg('')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = () => {
    if (!url.trim()) { setValidationMsg('Please paste a YouTube URL first.'); return }
    if (!selectedSubjectId) { setValidationMsg('Please select or create a subject.'); return }
    if (!selectedTopicId) { setValidationMsg('Please select or create a topic.'); return }
    setValidationMsg('')
    onGenerate(url.trim(), selectedSubjectId, selectedTopicId)
    handleClose()
  }

  const handleFetchPlaylist = async () => {
    if (!playlistUrl.trim()) { setPlaylistError('Paste a YouTube playlist URL first.'); return }
    setPlaylistLoading(true)
    setPlaylistError('')
    setPlaylistVideos([])
    try {
      const info = await getPlaylistInfo(playlistUrl.trim())
      setPlaylistVideos(info.videos)
      setPlaylistTotal(info.total_videos)
      setPlaylistCapped(info.capped)
      const titles: Record<string, string> = {}
      info.videos.forEach(v => { titles[v.video_id] = v.title })
      setEditedTitles(titles)
    } catch (e: any) {
      setPlaylistError(e.message || 'Failed to fetch playlist')
    } finally {
      setPlaylistLoading(false)
    }
  }

  const handleGeneratePlaylist = async () => {
    if (!playlistUrl.trim()) { setValidationMsg('Please paste a YouTube playlist URL first.'); return }
    if (playlistVideos.length === 0) { setValidationMsg('Preview the playlist before generating.'); return }
    if (!selectedSubjectId) { setValidationMsg('Please select or create a subject.'); return }
    setValidationMsg('')
    setPlaylistConfirming(true)
    try {
      const videosWithTopics: { video_id: string; title: string; topic_id: string }[] = []
      for (const video of playlistVideos) {
        const topicName = editedTitles[video.video_id] || video.title
        const topic = await createTopic(selectedSubjectId, topicName, undefined, 'pending')
        if (!topic?.id) throw new Error('Failed to create topic: ' + topicName)
        videosWithTopics.push({ video_id: video.video_id, title: topicName, topic_id: topic.id })
      }
      onGeneratePlaylist?.(playlistUrl.trim(), selectedSubjectId, videosWithTopics)
      handleClose()
    } catch (e: any) {
      setValidationMsg(e.message || 'Failed to prepare playlist')
    } finally {
      setPlaylistConfirming(false)
    }
  }

  const handlePickPdf = async () => {
    resetExtract()
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const file = result.assets[0]
    setPdfFile({ uri: file.uri, name: file.name ?? 'document.pdf' })
  }

  const handleGeneratePdf = async () => {
    if (!pdfFile) { setValidationMsg('Please pick a PDF file first.'); return }
    if (!selectedSubjectId) { setValidationMsg('Please select or create a subject.'); return }
    if (!selectedTopicId) { setValidationMsg('Please select or create a topic.'); return }
    setValidationMsg('')
    const res = await extractText(pdfFile.uri)
    if (!res) return
    onGeneratePdf?.(res.text, res.pages, selectedSubjectId, selectedTopicId)
    handleClose()
  }

  const isCurrentTabGenerating =
    (tab === 'playlist' && playlistConfirming) ||
    (tab === 'pdf' && pdfLoading)

  const subjectTopicSection = (showTopic: boolean) => (
    <>
      <Text style={styles.label}>Subject</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: Spacing.sm }}
        contentContainerStyle={{ paddingHorizontal: 2 }}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.chipRow}>
          {subjects.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, selectedSubjectId === s.id && styles.chipActive]}
              onPress={() => { setSelectedSubjectId(s.id); setSelectedTopicId(null); setValidationMsg('') }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, selectedSubjectId === s.id && styles.chipTextActive]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, styles.chipAdd]}
            onPress={() => setAddingSubject(v => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color={Colors.blue.default} />
            <Text style={[styles.chipText, { color: Colors.blue.default }]}>New</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {addingSubject && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newSubjectName}
            onChangeText={setNewSubjectName}
            placeholder="Subject name..."
            placeholderTextColor={Colors.text.muted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAddSubject}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddSubject} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="checkmark" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      )}

      {showTopic && selectedSubjectId && (
        <>
          <Text style={styles.label}>Topic</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: Spacing.sm }}
            contentContainerStyle={{ paddingHorizontal: 2 }}
            keyboardShouldPersistTaps="always"
          >
            <View style={styles.chipRow}>
              {topics.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, selectedTopicId === t.id && styles.chipActive]}
                  onPress={() => { setSelectedTopicId(t.id); setValidationMsg('') }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, selectedTopicId === t.id && styles.chipTextActive]}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.chip, styles.chipAdd]}
                onPress={() => setAddingTopic(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={Colors.blue.default} />
                <Text style={[styles.chipText, { color: Colors.blue.default }]}>New</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {addingTopic && (
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={newTopicName}
                onChangeText={setNewTopicName}
                placeholder="Topic name..."
                placeholderTextColor={Colors.text.muted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAddTopic}
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddTopic} disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="checkmark" size={18} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {showTopic && !selectedSubjectId && (
        <Text style={styles.hintText}>Select a subject to see its topics.</Text>
      )}
    </>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/*
        NO KeyboardAvoidingView anywhere.

        The sheet sits at the bottom via justifyContent:'flex-end'.
        The ScrollView inside uses:
          - automaticallyAdjustKeyboardInsets (iOS 15+): lets the system
            inset the scroll content exactly by the keyboard height.
          - keyboardDismissMode="on-drag": swipe down to dismiss keyboard.
          - keyboardShouldPersistTaps="always": taps on chips work while
            keyboard is open.

        The sheet height never changes when keyboard appears — only the
        scrollable area's bottom inset grows, so the content stays
        reachable by scrolling. The modal doesn't shrink or jump.
      */}
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Generate Notes</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'video' && styles.tabActive]}
              onPress={() => handleTabChange('video')}
            >
              <Ionicons name="play-circle-outline" size={15} color={tab === 'video' ? Colors.blue.default : Colors.text.muted} />
              <Text style={[styles.tabText, tab === 'video' && styles.tabTextActive]}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'playlist' && styles.tabActive]}
              onPress={() => handleTabChange('playlist')}
            >
              <Ionicons name="list-outline" size={15} color={tab === 'playlist' ? Colors.blue.default : Colors.text.muted} />
              <Text style={[styles.tabText, tab === 'playlist' && styles.tabTextActive]}>Playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'pdf' && styles.tabActive]}
              onPress={() => handleTabChange('pdf')}
            >
              <Ionicons name="document-text-outline" size={15} color={tab === 'pdf' ? Colors.blue.default : Colors.text.muted} />
              <Text style={[styles.tabText, tab === 'pdf' && styles.tabTextActive]}>PDF</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              // Bottom padding so content clears the home indicator
              { paddingBottom: insets.bottom + Spacing['2xl'] },
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="always"
            // iOS 15+: system adjusts scroll insets by exact keyboard height.
            // No resize, no jump — the sheet stays put and content scrolls up.
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            nestedScrollEnabled={true}
          >
            {tab === 'video' && (
              <>
                <Text style={styles.label}>YouTube URL</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="logo-youtube" size={18} color={Colors.red.default} />
                  <TextInput
                    style={styles.input}
                    value={url}
                    onChangeText={v => { setUrl(v); setValidationMsg('') }}
                    placeholder="Paste a YouTube link..."
                    placeholderTextColor={Colors.text.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    blurOnSubmit={true}
                  />
                  {url.length > 0 && (
                    <TouchableOpacity onPress={() => setUrl('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
                {subjectTopicSection(true)}
              </>
            )}

            {tab === 'playlist' && (
              <>
                <Text style={styles.label}>Playlist URL</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="logo-youtube" size={18} color={Colors.red.default} />
                  <TextInput
                    style={styles.input}
                    value={playlistUrl}
                    onChangeText={v => { setPlaylistUrl(v); setPlaylistError('') }}
                    placeholder="Paste a YouTube playlist link..."
                    placeholderTextColor={Colors.text.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    blurOnSubmit={true}
                  />
                  {playlistUrl.length > 0 && (
                    <TouchableOpacity
                      onPress={() => { setPlaylistUrl(''); setPlaylistVideos([]); setPlaylistError('') }}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.previewBtn, playlistLoading && { opacity: 0.6 }]}
                  onPress={handleFetchPlaylist}
                  disabled={playlistLoading}
                  activeOpacity={0.8}
                >
                  {playlistLoading
                    ? <ActivityIndicator size="small" color={Colors.blue.default} />
                    : <Ionicons name="search-outline" size={16} color={Colors.blue.default} />
                  }
                  <Text style={styles.previewBtnText}>
                    {playlistLoading ? 'Fetching...' : 'Preview Playlist'}
                  </Text>
                </TouchableOpacity>

                {playlistError.length > 0 && (
                  <View style={styles.validationRow}>
                    <Ionicons name="alert-circle-outline" size={15} color={Colors.red.default} />
                    <Text style={styles.validationText}>{playlistError}</Text>
                  </View>
                )}

                {playlistVideos.length > 0 && (
                  <>
                    {playlistCapped && (
                      <View style={styles.capNotice}>
                        <Ionicons name="information-circle-outline" size={15} color={Colors.warning} />
                        <Text style={styles.capText}>Processing first 10 of {playlistTotal} videos</Text>
                      </View>
                    )}
                    <Text style={styles.label}>Videos — tap to rename</Text>
                    {playlistVideos.map((v, i) => (
                      <View key={v.video_id} style={styles.videoRow}>
                        <View style={styles.videoIndex}>
                          <Text style={styles.videoIndexText}>{i + 1}</Text>
                        </View>
                        <TextInput
                          style={styles.videoTitle}
                          value={editedTitles[v.video_id] ?? v.title}
                          onChangeText={text => setEditedTitles(prev => ({ ...prev, [v.video_id]: text }))}
                          placeholderTextColor={Colors.text.muted}
                        />
                      </View>
                    ))}
                  </>
                )}

                {subjectTopicSection(false)}

                <View style={styles.playlistHint}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.text.muted} />
                  <Text style={styles.playlistHintText}>
                    Each video becomes its own topic under the selected subject.
                  </Text>
                </View>
              </>
            )}

            {tab === 'pdf' && (
              <>
                <Text style={styles.label}>PDF File</Text>
                <TouchableOpacity
                  style={styles.pdfPickBtn}
                  onPress={handlePickPdf}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={pdfFile ? 'document-text' : 'document-text-outline'}
                    size={20}
                    color={pdfFile ? Colors.success : Colors.text.muted}
                  />
                  <Text style={[styles.pdfPickText, pdfFile && styles.pdfPickTextActive]} numberOfLines={1}>
                    {pdfFile ? pdfFile.name : 'Tap to pick a PDF...'}
                  </Text>
                  {pdfFile && (
                    <TouchableOpacity onPress={() => setPdfFile(null)} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {extractStatus === 'error' && extractError && (
                  <View style={styles.validationRow}>
                    <Ionicons name="alert-circle-outline" size={15} color={Colors.red.default} />
                    <Text style={styles.validationText}>{extractError}</Text>
                  </View>
                )}

                {subjectTopicSection(true)}
              </>
            )}

            {validationMsg.length > 0 && (
              <View style={styles.validationRow}>
                <Ionicons name="alert-circle-outline" size={15} color={Colors.red.default} />
                <Text style={styles.validationText}>{validationMsg}</Text>
              </View>
            )}

            {isGuestLimitReached && (
              <View style={styles.guestLimitRow}>
                <Ionicons name="lock-closed-outline" size={15} color={Colors.red.default} />
                <Text style={[styles.validationText, { flex: 1 }]}>
                  You've used your 3 free notes.{' '}
                  <Text
                    style={{ color: Colors.blue.default, textDecorationLine: 'underline' }}
                    onPress={() => { handleClose(); router.push('/auth/login') }}
                  >
                    Sign up to continue
                  </Text>
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.generateBtn, (isGuestLimitReached || isCurrentTabGenerating) && { opacity: 0.5 }]}
              onPress={() => {
                if (tab === 'video') handleGenerate()
                else if (tab === 'playlist') handleGeneratePlaylist()
                else handleGeneratePdf()
              }}
              disabled={isGuestLimitReached || isCurrentTabGenerating}
              activeOpacity={0.8}
            >
              {isCurrentTabGenerating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="sparkles" size={18} color="#fff" />
              }
              <Text style={styles.generateText}>
                {isCurrentTabGenerating
                  ? tab === 'pdf' ? 'Extracting...' : 'Preparing...'
                  : tab === 'playlist' && playlistVideos.length > 0
                    ? `Generate ${playlistVideos.length} Notes`
                    : 'Generate Notes'
                }
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // Full-screen container, sheet floats at the bottom.
  // No KAV here — the sheet height must not change when keyboard appears.
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  // Backdrop is a sibling of the sheet (not a wrapper) so its onPress
  // closes the modal without interfering with touches inside the sheet.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Layout.borderRadius.xl,
    borderTopRightRadius: Layout.borderRadius.xl,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
    // Natural height: grows with content up to 90% of screen.
    // Does NOT flex:1 — that would force it to full height always.
    maxHeight: '90%',
  },
  scrollContent: {
    // Top padding only; bottom is set dynamically with insets.bottom
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: Typography.size.lg, fontFamily: Typography.family.bold, color: Colors.text.primary },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Layout.borderRadius.md,
    padding: 3,
    gap: 3,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: Spacing.sm,
    borderRadius: Layout.borderRadius.sm,
  },
  tabActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabText: { fontSize: Typography.size.xs, fontFamily: Typography.family.medium, color: Colors.text.muted },
  tabTextActive: { color: Colors.blue.default },
  label: {
    fontSize: Typography.size.sm,
    fontFamily: Typography.family.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  hintText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.regular,
    color: Colors.text.muted,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  input: { flex: 1, fontSize: Typography.size.md, fontFamily: Typography.family.regular, color: Colors.text.primary },
  addInput: {
    flex: 1,
    fontSize: Typography.size.md,
    fontFamily: Typography.family.regular,
    color: Colors.text.primary,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Layout.borderRadius.full,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: 'rgba(74,158,255,0.15)', borderColor: Colors.blue.default },
  chipAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, borderColor: 'rgba(74,158,255,0.3)', backgroundColor: 'rgba(74,158,255,0.05)' },
  chipText: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.text.secondary },
  chipTextActive: { color: Colors.blue.default },
  addRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  addBtn: { width: 44, height: 44, borderRadius: Layout.borderRadius.md, backgroundColor: Colors.blue.default, alignItems: 'center', justifyContent: 'center' },
  validationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm, marginTop: Spacing.xs },
  validationText: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.red.default },
  guestLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    backgroundColor: 'rgba(255,59,48,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.2)',
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.sm,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.blue.default,
    paddingVertical: Spacing.md,
    borderRadius: Layout.borderRadius.full,
    marginTop: Spacing.md,
  },
  generateText: { fontSize: Typography.size.md, fontFamily: Typography.family.semibold, color: '#fff' },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.blue.default,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Layout.borderRadius.full,
    marginBottom: Spacing.md,
  },
  previewBtnText: { fontSize: Typography.size.sm, fontFamily: Typography.family.semibold, color: Colors.blue.default },
  capNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    borderRadius: Layout.borderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  capText: { fontSize: Typography.size.sm, fontFamily: Typography.family.medium, color: Colors.warning },
  playlistHint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm, opacity: 0.7 },
  playlistHintText: { fontSize: Typography.size.xs, fontFamily: Typography.family.regular, color: Colors.text.muted, flex: 1 },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Layout.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  videoIndex: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  videoIndexText: { fontSize: Typography.size.xs, fontFamily: Typography.family.bold, color: Colors.text.muted },
  videoTitle: { flex: 1, fontSize: Typography.size.sm, fontFamily: Typography.family.regular, color: Colors.text.primary, paddingVertical: Spacing.xs },
  pdfPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  pdfPickText: { flex: 1, fontSize: Typography.size.md, fontFamily: Typography.family.regular, color: Colors.text.muted },
  pdfPickTextActive: { color: Colors.text.primary },
})
