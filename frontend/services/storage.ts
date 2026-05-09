import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  subjects: 'guest:subjects',
  topics: (subjectId: string) => `guest:topics:${subjectId}`,
  notes: (topicId: string) => `guest:notes:${topicId}`,
};

// --- Subjects ---
export async function getGuestSubjects() {
  const raw = await AsyncStorage.getItem(KEYS.subjects);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
export async function saveGuestSubject(subject: { id: string; name: string; description?: string | null; created_at: string }) {
  const existing = await getGuestSubjects();
  await AsyncStorage.setItem(KEYS.subjects, JSON.stringify([subject, ...existing]));
}

export async function deleteGuestSubject(subjectId: string) {
  const existing = await getGuestSubjects();
  await AsyncStorage.setItem(KEYS.subjects, JSON.stringify(existing.filter((s: any) => s.id !== subjectId)));
  const topics = await getGuestTopics(subjectId);
  await Promise.all(topics.map((t: any) => AsyncStorage.removeItem(KEYS.notes(t.id))));
  await AsyncStorage.removeItem(KEYS.topics(subjectId));
}

// --- Topics ---
export async function getGuestTopics(subjectId: string) {
  const raw = await AsyncStorage.getItem(KEYS.topics(subjectId));
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function saveGuestTopic(topic: { id: string; subject_id: string; name: string; description?: string | null; created_at: string; generation_status?: string | null }) {
  const existing = await getGuestTopics(topic.subject_id);
  await AsyncStorage.setItem(KEYS.topics(topic.subject_id), JSON.stringify([topic, ...existing]));
}

export async function deleteGuestTopic(subjectId: string, topicId: string) {
  const existing = await getGuestTopics(subjectId);
  await AsyncStorage.setItem(KEYS.topics(subjectId), JSON.stringify(existing.filter((t: any) => t.id !== topicId)));
  await AsyncStorage.removeItem(KEYS.notes(topicId));
}

// --- Notes ---
export async function getGuestNotes(topicId: string) {
  const raw = await AsyncStorage.getItem(KEYS.notes(topicId));
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function saveGuestNote(note: { id: string; topic_id: string; title: string; content: string; created_at: string }) {
  const existing = await getGuestNotes(note.topic_id);
  await AsyncStorage.setItem(KEYS.notes(note.topic_id), JSON.stringify([note, ...existing]));
}

export async function deleteGuestNote(topicId: string, noteId: string) {
  const existing = await getGuestNotes(topicId);
  await AsyncStorage.setItem(KEYS.notes(topicId), JSON.stringify(existing.filter((n: any) => n.id !== noteId)));
}

// --- Clear everything on sign out / account creation ---
export async function clearGuestData() {
  const keys = await AsyncStorage.getAllKeys();
  const guestKeys = keys.filter(k => k.startsWith('guest:'));
  await AsyncStorage.multiRemove(guestKeys);
}