import { getAuthHeader, BASE_URL, apiGet } from './client';

export interface PlaylistVideo {
  video_id: string;
  title: string;
  position: number;
}

export interface PlaylistInfo {
  playlist_id: string;
  total_videos: number;
  capped: boolean;
  videos: PlaylistVideo[];
}

export type PlaylistEvent =
  | { type: 'topic_done'; topic_id: string; index: number }
  | { type: 'topic_failed'; topic_id: string; reason: string }
  | { type: 'playlist_done' }
  | { type: 'playlist_error'; reason: string }

export const getPlaylistInfo = (url: string): Promise<PlaylistInfo> =>
  apiGet<PlaylistInfo>(`/playlist/info?url=${encodeURIComponent(url)}`);

/**
 * Parse SSE blocks from a text chunk and fire onEvent for each complete event.
 */

function parseSseText(text: string, onEvent: (event: PlaylistEvent) => void) {
  const blocks = text.split('\n\n');
  for (const block of blocks) {
    if (!block.trim()) continue;
    let eventName = '';
    let dataStr = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) eventName = line.slice(7).trim();
      if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
    }
    if (!eventName || !dataStr) continue;
    try {
      const payload = JSON.parse(dataStr);
      if (eventName === 'topic_done') {
        onEvent({ type: 'topic_done', topic_id: payload.topic_id, index: payload.index });
      } else if (eventName === 'topic_failed') {
        onEvent({ type: 'topic_failed', topic_id: payload.topic_id, reason: payload.reason });
      } else if (eventName === 'playlist_done') {
        onEvent({ type: 'playlist_done' });
      } else if (eventName === 'playlist_error') {
        throw new Error(payload.reason ?? 'Playlist generation failed');
      }
    } catch (err) {
      if (err instanceof Error && eventName === 'playlist_error') throw err;
    }
  }
}

export const generatePlaylist = async (
  playlistUrl: string,
  subjectId: string,
  videos: { video_id: string; title: string; topic_id: string }[],
  onEvent: (event: PlaylistEvent) => void,
): Promise<void> => {
  const headers = await getAuthHeader();

  // XHR onprogress fires incrementally on React Native as chunks arrive.
  // fetch() on RN buffers the entire SSE response before resolving (res.body
  // is undefined on RN) so all events would fire at once after 80-100 min of
  // silence. XHR is built into RN — no extra dependency needed.
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processedLength = 0;

    xhr.open('POST', `${BASE_URL}/generate/playlist`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v as string));

    xhr.onprogress = () => {
      const newChunk = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      if (!newChunk) return;
      try {
        parseSseText(newChunk, onEvent);
      } catch (err) {
        xhr.abort();
        reject(err);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 400) {
        let message = xhr.responseText;
        try { message = JSON.parse(xhr.responseText).detail ?? message; } catch {}
        reject(new Error(message));
        return;
      }
      // Parse any final chunk onprogress may have missed
      const remaining = xhr.responseText.slice(processedLength);
      if (remaining) {
        try { parseSseText(remaining, onEvent); } catch (err) { reject(err); return; }
      }
      resolve();
    };

    xhr.onerror = () => reject(new Error('Network error during playlist generation'));

    // No timeout — each video takes 20-25 min, let the backend control completion
    xhr.timeout = 0;

    xhr.send(JSON.stringify({ playlist_url: playlistUrl, subject_id: subjectId, videos }));
  });
};
