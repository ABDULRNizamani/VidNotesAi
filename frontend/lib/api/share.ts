import { apiGet, apiPost } from './client';

export interface CreateShareResponse {
  token: string;
  warn: boolean;
  warn_message: string | null;
}

export interface ShareNote {
  id: string;
  title: string;
  preview: string;
}

export interface SharePreviewResponse {
  notes: ShareNote[];
  requires_account: boolean;
}

export interface ImportShareResponse {
  imported_note_ids: string[];
}

export const createShareLink = (noteIds: string[]) =>
  apiPost<CreateShareResponse>('/share/create', { note_ids: noteIds });

export const previewShare = (token: string) =>
  apiGet<SharePreviewResponse>(`/share/preview/${token}`);

export const importShare = (token: string, topicId: string) =>
  apiPost<ImportShareResponse>(`/share/import/${token}`, { topic_id: topicId });