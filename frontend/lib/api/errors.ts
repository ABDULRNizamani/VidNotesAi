/**
 * Centralized API error handler for VidNotes AI.
 *
 * Usage:
 *   import { parseApiError, ApiErrorType } from '@/lib/api/errors';
 *
 *   try { ... } catch (e) {
 *     const err = parseApiError(e);
 *     if (err.type === ApiErrorType.GUEST_LIMIT) { ... }
 *     showToast(err.userMessage);
 *   }
 */

export enum ApiErrorType {
  // Auth
  AUTH_EXPIRED = 'AUTH_EXPIRED',

  // Rate limits
  RATE_LIMIT_REQUESTS = 'RATE_LIMIT_REQUESTS',
  RATE_LIMIT_CONCURRENT = 'RATE_LIMIT_CONCURRENT',
  RATE_LIMIT_PLAYLIST = 'RATE_LIMIT_PLAYLIST',
  RATE_LIMIT_PDF_EXPORT_DAILY = 'RATE_LIMIT_PDF_EXPORT_DAILY',
  RATE_LIMIT_PDF_EXPORT_WEEKLY = 'RATE_LIMIT_PDF_EXPORT_WEEKLY',
  RATE_LIMIT_PDF_IMPORT_DAILY = 'RATE_LIMIT_PDF_IMPORT_DAILY',
  

  // Guest
  GUEST_LIMIT = 'GUEST_LIMIT',
  GUEST_PDF_LIMIT = 'GUEST_PDF_LIMIT',

  // Ownership / access
  ACCESS_DENIED = 'ACCESS_DENIED',

  // Validation
  TOPIC_FULL = 'TOPIC_FULL',
  PLAYLIST_TOO_LONG = 'PLAYLIST_TOO_LONG',
  PDF_EXPORT_TOO_MANY = 'PDF_EXPORT_TOO_MANY',
  TEXT_TOO_LARGE = 'TEXT_TOO_LARGE',
  IMPORT_TOPIC_FULL = 'IMPORT_TOPIC_FULL',
  NO_NOTES_FOUND = 'NO_NOTES_FOUND',
  SHARE_LINK_INVALID = 'SHARE_LINK_INVALID',
  NO_SUBJECTS = 'NO_SUBJECTS',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',

  // Content
  TRANSCRIPTS_DISABLED = 'TRANSCRIPTS_DISABLED',
  NO_TRANSCRIPT = 'NO_TRANSCRIPT',
  PDF_SCANNED = 'PDF_SCANNED',

  // AI / server
  AI_UNAVAILABLE = 'AI_UNAVAILABLE',
  SERVER_ERROR = 'SERVER_ERROR',

  // Network
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Unknown
  UNKNOWN = 'UNKNOWN',
}

export interface ApiError {
  type: ApiErrorType;
  /** Ready-to-display message for the user */
  userMessage: string;
  /** Raw error message from server */
  raw: string;
  /** Whether to show a retry button */
  retryable: boolean;
  /** Whether this needs special UI treatment (not just a toast) */
  special: boolean;
}

const RETRY_DELAY_REGEX = /try again in (\d+)/i;

export function parseApiError(error: unknown): ApiError {
  const raw = error instanceof Error ? error.message : String(error);

  // ── Network 
  if (
    raw.includes('Network request failed') ||
    raw.includes('Failed to fetch') ||
    raw.includes('NetworkError') ||
    raw.includes('net::ERR')
  ) {
    return make(ApiErrorType.NETWORK_ERROR, 'No internet connection. Please check your network and try again.', raw, true, false);
  }

  // ── Auth
   if (raw.includes('Unauthorized')) {
     return make(ApiErrorType.AUTH_EXPIRED, 'Your session expired. Please sign in again.', raw, false, true);
    }

  // ── Rate limits
  if (raw.includes('AI requests per') || raw.includes('Too many requests')) {
    const match = raw.match(RETRY_DELAY_REGEX);
    const suffix = match ? ` Try again in ${match[1]}s.` : ' Please slow down.';
    return make(ApiErrorType.RATE_LIMIT_REQUESTS, `Too many requests.${suffix}`, raw, true, false);
  }
  if (raw.includes('requests running. Wait for one to finish')) {
    return make(ApiErrorType.RATE_LIMIT_CONCURRENT, 'Please wait for your current generation to finish.', raw, false, false);
  }
  if (raw.includes('playlist generating')) {
    return make(ApiErrorType.RATE_LIMIT_PLAYLIST, 'A playlist is already being generated. Please wait.', raw, false, false);
  }
  if (raw.includes('PDF export limit: 5 per day')) {
    return make(ApiErrorType.RATE_LIMIT_PDF_EXPORT_DAILY, 'Daily PDF export limit reached. Try again tomorrow.', raw, false, false);
  }
  if (raw.includes('PDF export limit: 10 per week')) {
    return make(ApiErrorType.RATE_LIMIT_PDF_EXPORT_WEEKLY, 'Weekly PDF export limit reached. Try again next week.', raw, false, false);
  }
  if (raw.includes('PDF extraction limit: 10 per day')) {
    return make(ApiErrorType.RATE_LIMIT_PDF_IMPORT_DAILY, 'Daily PDF import limit reached. Try again tomorrow.', raw, false, false);
  }

  // ── Guest 
  if (raw === 'guest_limit_reached' || raw.includes('guest_limit_reached')) {
    return make(ApiErrorType.GUEST_LIMIT, "You've reached the free limit. Sign up to generate more notes.", raw, false, true);
  }

  if (raw === 'guest_pdf_limit_reached' || raw.includes('guest_pdf_limit_reached')) {
    return make(ApiErrorType.GUEST_PDF_LIMIT, "You've used your free PDF import. Sign up to import more.", raw, false, true);
  }

  // ── Ownership / access 
  if (
    raw.includes("don't own that topic") ||
    raw.includes("don't own that note") ||
    raw.includes('Access denied')
  ) {
    return make(ApiErrorType.ACCESS_DENIED, 'Something went wrong. Please try again.', raw, false, false);
  }

  // ── Validation 
  if (raw.includes('Max 7 notes')) {
    return make(ApiErrorType.TOPIC_FULL, 'This topic is full. Delete a note to make space.', raw, false, true);
  }
  if (raw.includes('Max 10 videos per playlist')) {
    return make(ApiErrorType.PLAYLIST_TOO_LONG, 'Max 10 videos per playlist.', raw, false, false);
  }
  if (raw.includes('Max 20 notes per PDF')) {
    return make(ApiErrorType.PDF_EXPORT_TOO_MANY, 'Select a maximum of 20 notes to export.', raw, false, false);
  }
  if (raw.includes('source_text too large') || raw.includes('max 200KB')) {
    return make(ApiErrorType.TEXT_TOO_LARGE, 'Text is too large to process. Try a shorter excerpt.', raw, false, false);
  }
  if (raw.includes('Import would exceed') || raw.includes('7-note limit')) {
    return make(ApiErrorType.IMPORT_TOPIC_FULL, 'Not enough space in this topic. Delete some notes first.', raw, false, false);
  }
  if (raw.includes('No notes found for selected topics')) {
    return make(ApiErrorType.NO_NOTES_FOUND, 'Generate some notes first before exporting.', raw, false, false);
  }
  if (raw.includes('Share link not found')) {
    return make(ApiErrorType.SHARE_LINK_INVALID, 'This share link is invalid or has expired.', raw, false, false);
  }
  if (raw.includes('No subjects found')) {
    return make(ApiErrorType.NO_SUBJECTS, 'Add a subject first to get started.', raw, false, false);
  }
  if (raw.includes('Session not found')) {
    return make(ApiErrorType.SESSION_NOT_FOUND, 'Chat session expired. Starting a new one.', raw, false, true);
  }

  // ── Content errors
  if (raw.includes('Transcripts are disabled')) {
    return make(ApiErrorType.TRANSCRIPTS_DISABLED, 'Transcripts are disabled for this video. Try a different one.', raw, false, false);
  }
  if (raw.includes('No transcript found')) {
    return make(ApiErrorType.NO_TRANSCRIPT, 'No transcript found for this video. Try a different one.', raw, false, false);
  }
  if (raw.includes('Could not extract text') || raw.includes('scanned')) {
    return make(ApiErrorType.PDF_SCANNED, 'This PDF appears to be scanned. Text extraction failed.', raw, false, false);
  }

  // ── AI / server
  if (raw.includes('AI service is temporarily unavailable') || raw.includes('AI is busy')) {
    return make(ApiErrorType.AI_UNAVAILABLE, 'AI is busy right now. Please try again in a few minutes.', raw, true, true);
  }
  if (raw.includes('Something went wrong')) {
    return make(ApiErrorType.SERVER_ERROR, 'Something went wrong. Please try again.', raw, true, false);
  }

  // ── Unknown 
  return make(ApiErrorType.UNKNOWN, 'Something went wrong. Please try again.', raw, true, false);
}

function make(
  type: ApiErrorType,
  userMessage: string,
  raw: string,
  retryable: boolean,
  special: boolean,
): ApiError {
  return { type, userMessage, raw, retryable, special };
}