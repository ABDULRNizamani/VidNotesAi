import { useState, useCallback } from 'react';
import { exportNotesPdf, extractPdfText, PdfExtractResponse } from '@/lib/api/pdf';
import { parseApiError, ApiError } from '@/lib/api/errors';
import { File, Paths } from 'expo-file-system/next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type PdfExportStatus = 'idle' | 'loading' | 'done' | 'error';
export type PdfExtractStatus = 'idle' | 'loading' | 'done' | 'error';

export function usePdf() {
  const [exportStatus, setExportStatus] = useState<PdfExportStatus>('idle');
  const [exportApiError, setExportApiError] = useState<ApiError | null>(null);

  const [extractStatus, setExtractStatus] = useState<PdfExtractStatus>('idle');
  const [extractResult, setExtractResult] = useState<PdfExtractResponse | null>(null);
  const [extractApiError, setExtractApiError] = useState<ApiError | null>(null);

  const exportNotes = useCallback(async (noteIds: string[], topicId?: string) => {
    setExportStatus('loading');
    setExportApiError(null);
    try {
      const blob = await exportNotesPdf(noteIds, topicId);

      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const filename = noteIds.length === 1 ? 'notes.pdf' : `notes_${noteIds.length}_combined.pdf`;
      const file = new File(Paths.cache, filename);
      await file.write(base64, { encoding: 'base64' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
      }
      setExportStatus('done');
    } catch (e) {
      setExportApiError(parseApiError(e));
      setExportStatus('error');
    }
  }, []);

  const extractText = useCallback(async (fileUri: string, mimeType = 'application/pdf') => {
    setExtractStatus('loading');
    setExtractApiError(null);
    setExtractResult(null);
    try {
      // Check file size before reading into memory
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists && (fileInfo as any).size > 10 * 1024 * 1024) {
        throw new Error('PDF too large. Max size is 10MB');
      }

      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64',
      });

      // React Native-compatible upload — skip blob conversion via data URI
      const result = await extractPdfText(fileUri, base64);

      setExtractResult(result);
      setExtractStatus('done');
      return result;
    } catch (e) {
      setExtractApiError(parseApiError(e));
      setExtractStatus('error');
      return null;
    }
  }, []);

  const resetExport = useCallback(() => {
    setExportStatus('idle');
    setExportApiError(null);
  }, []);

  const resetExtract = useCallback(() => {
    setExtractStatus('idle');
    setExtractResult(null);
    setExtractApiError(null);
  }, []);

  return {
    exportStatus,
    exportApiError,
    exportError: exportApiError?.userMessage ?? null,
    exportNotes,
    resetExport,
    extractStatus,
    extractResult,
    extractApiError,
    extractError: extractApiError?.userMessage ?? null,
    extractText,
    resetExtract,
  };
}