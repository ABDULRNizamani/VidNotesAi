import { apiGet, apiPost, apiPatch, apiStream } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: string;
  created_at: string;
}

export interface StartSessionResponse {
  session_id: string;
}

export interface MessagesResponse {
  messages: ChatMessage[];
}

export interface SessionsResponse {
  sessions: ChatSession[];
}

export const startSession = (noteIds: string[], mode: 'explain' | 'quiz' | 'socratic' = 'explain') =>
  apiPost<StartSessionResponse>('/chat/session', { note_ids: noteIds, mode });

export const updateSessionMode = (sessionId: string, mode: 'explain' | 'quiz' | 'socratic') =>
  apiPatch<{ mode: string }>(`/chat/session/${sessionId}/mode`, { mode });

// Streaming for text — returns raw Response. For image sends, returns { reply, session_id }
export const sendMessage = (sessionId: string, message: string, imageBase64?: string) =>
  apiStream('/chat/message', {
    session_id: sessionId,
    message,
    image_base64: imageBase64,
  });

export const getHistory = (sessionId: string) =>
  apiGet<MessagesResponse>(`/chat/history/${sessionId}`);

// user_id in URL but backend actually uses the JWT user — pass anything, backend ignores the param
export const getSessions = () => apiGet<SessionsResponse>('/chat/sessions');