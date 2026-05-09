import { apiPostBlob, getAuthHeader } from './client';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

export interface PdfExtractResponse {
  text: string;
  pages: number;
  chars: number;
}

export const exportNotesPdf = (noteIds: string[], topicId?: string) =>
  apiPostBlob('/api/pdf/notes', { note_ids: noteIds, topic_id: topicId });

// React Native-compatible: use fileUri + base64 directly instead of blob
export async function extractPdfText(fileUri: string, base64: string): Promise<PdfExtractResponse> {
  const headers = await getAuthHeader();
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: 'document.pdf',
    type: 'application/pdf',
  } as any);
  const res = await fetch(`${BASE_URL}/api/pdf/extract`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    try {
      const json = JSON.parse(errText);
      throw new Error(json.detail ?? errText);
    } catch {
      throw new Error(errText);
    }
  }
  return res.json();
}
