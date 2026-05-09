import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/supabase';
import { getGuestSubjects, getGuestTopics, getGuestNotes } from '@/services/storage';

let isMigrating = false;
const MIGRATION_DONE_KEY = (userId: string) => `migration:done:${userId}`;

export async function migrateGuestNotesToSupabase(userId: string) {
  if (isMigrating) {
    console.log('[migration] Already in progress, skipping');
    return;
  }

  const alreadyDone = await AsyncStorage.getItem(MIGRATION_DONE_KEY(userId));
  if (alreadyDone === 'true') {
    console.log('[migration] Already completed for this user, skipping');
    return;
  }

  isMigrating = true;

  try {
    const subjects = await getGuestSubjects();
    if (subjects.length === 0) {
      console.log('[migration] No guest subjects to migrate');
      await AsyncStorage.setItem(MIGRATION_DONE_KEY(userId), 'true');
      return;
    }

    type GuestNote = { id: string; topic_id: string; title: string; content: string; created_at: string };
    type GuestTopic = { id: string; subject_id: string; name: string; description: string | null; created_at: string; generation_status: string | null; notes: GuestNote[] };
    type GuestSubject = { id: string; name: string; description: string | null; created_at: string; topics: GuestTopic[] };

    const snapshot: GuestSubject[] = [];

    for (const subject of subjects) {
      const topics = await getGuestTopics(subject.id);
      const topicsWithNotes: GuestTopic[] = [];
      for (const topic of topics) {
        const notes = await getGuestNotes(topic.id);
        topicsWithNotes.push({ ...topic, notes });
      }
      snapshot.push({ ...subject, topics: topicsWithNotes });
    }

    console.log(`[migration] Snapshot complete — ${snapshot.length} subjects, ${snapshot.reduce((a, s) => a + s.topics.length, 0)} topics, ${snapshot.reduce((a, s) => a + s.topics.reduce((b, t) => b + t.notes.length, 0), 0)} notes`);

    // ── Now write to Supabase ──
    let anyFailed = false;

    for (const subject of snapshot) {
      const { error: subjectError } = await supabase
        .from('subjects')
        .insert({
          id: subject.id,
          user_id: userId,
          name: subject.name,
          description: subject.description ?? null,
          created_at: subject.created_at,
        });

      console.log('[migration] subject:', subject.name, '→', subjectError?.message ?? 'ok');

      if (subjectError && !subjectError.message.includes('duplicate key')) {
        console.log('[migration] Subject failed, skipping its topics');
        anyFailed = true;
        continue;
      }

      for (const topic of subject.topics) {
        const { error: topicError } = await supabase
          .from('topics')
          .insert({
            id: topic.id,
            subject_id: subject.id,
            name: topic.name,
            description: topic.description ?? null,
            created_at: topic.created_at,
            generation_status: topic.generation_status ?? null,
          });

        console.log('[migration] topic:', topic.name, '→', topicError?.message ?? 'ok');

        if (topicError && !topicError.message.includes('duplicate key')) {
          console.log('[migration] Topic failed, skipping its notes');
          anyFailed = true;
          continue;
        }

        for (const note of topic.notes) {
          const { error: noteError } = await supabase
            .from('notes')
            .insert({
              id: note.id,
              topic_id: topic.id,
              title: note.title,
              content: note.content,
              status: 'active',
              created_at: note.created_at,
              expires_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
            });

          console.log('[migration] note:', note.title, '→', noteError?.message ?? 'ok');

          if (noteError && !noteError.message.includes('duplicate key')) {
            anyFailed = true;
          }
        }
      }
    }

    // ── Only wipe guest data if everything succeeded ──
    // If any insert failed, leave guest data intact so migration retries next sign-in.
    if (anyFailed) {
      console.log('[migration] Some inserts failed — keeping guest data for retry on next sign-in');
      return;
    }

    const keys = await AsyncStorage.getAllKeys();
    const guestKeys = keys.filter(k => k.startsWith('guest:'));
    if (guestKeys.length > 0) {
      await AsyncStorage.multiRemove(guestKeys);
      console.log(`[migration] Cleared ${guestKeys.length} guest keys`);
    }

    await AsyncStorage.setItem(MIGRATION_DONE_KEY(userId), 'true');
    console.log('[migration] Done!');
  } catch (e: any) {
    console.log('[migration] Failed:', e.message);
  } finally {
    isMigrating = false;
  }
}
