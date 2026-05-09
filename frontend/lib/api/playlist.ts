import { apiGet, apiPost } from './client';

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

export const getPlaylistInfo = (url: string): Promise<PlaylistInfo> =>
  apiGet<PlaylistInfo>(`/playlist/info?url=${encodeURIComponent(url)}`);

export const generatePlaylist = async (
  playlistUrl: string,
  subjectId: string,
  videos: { video_id: string; title: string; topic_id: string }[],
  onEvent: (event: PlaylistEvent) => void,
): Promise<void> => {
  const data = await apiPost<{ results: { topic_id: string; status: string; reason?: string }[] }>(
    '/generate/playlist',
    { playlist_url: playlistUrl, subject_id: subjectId, videos }
  );

  for (const result of data.results) {
    if (result.status === 'done') {
      onEvent({ type: 'topic_done', topic_id: result.topic_id, index: 0 });
    } else {
      onEvent({ type: 'topic_failed', topic_id: result.topic_id, reason: result.reason ?? 'Unknown error' });
    }
  }

  onEvent({ type: 'playlist_done' });
};