import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Predefined report reasons, shown in the report ActionSheet. */
export const LISTING_REPORT_REASONS = [
  'Contenido inapropiado',
  'Producto prohibido',
  'Publicación falsa o engañosa',
  'Otra razón',
] as const;

export const USER_REPORT_REASONS = [
  'Comportamiento abusivo',
  'Estafa o fraude',
  'Spam',
  'Otra razón',
] as const;

/**
 * Reports a listing or a user by inserting into the shared `reports` table
 * (web repo migration). `reporter_id` is resolved server-side from the
 * session (RLS / default auth.uid()), so the client only sends the target
 * and the reason. Callers show the success toast.
 *
 * A lightweight module-level dedupe blocks re-reporting the same
 * (target_type, target_id) within a short window: double-taps or rapid
 * re-opens of the report sheet can't flood the `reports` table. The window
 * starts when the insert is attempted and is cleared on failure, so a real
 * error can still be retried. Callers surface the thrown message via their
 * existing error toast.
 */
const REPORT_DEDUPE_WINDOW_MS = 10_000;
const lastReportAt = new Map<string, number>();

/**
 * Drops expired dedupe entries so the module-level map can't grow
 * unbounded (entries are only useful within the dedupe window). Called on
 * every report attempt, so the map stays tiny; dedupe behavior is
 * unchanged — expired entries were already ignored by the window check.
 */
function pruneExpiredReports(now: number) {
  for (const [key, ts] of lastReportAt) {
    if (now - ts >= REPORT_DEDUPE_WINDOW_MS) lastReportAt.delete(key);
  }
}

export function useReport() {
  return useMutation({
    mutationFn: async ({
      targetType,
      targetId,
      reason,
    }: {
      targetType: 'listing' | 'user';
      targetId: string;
      reason: string;
    }) => {
      const now = Date.now();
      pruneExpiredReports(now);
      const key = `${targetType}:${targetId}`;
      const last = lastReportAt.get(key) ?? 0;
      if (now - last < REPORT_DEDUPE_WINDOW_MS) {
        throw new Error(
          targetType === 'listing'
            ? 'Ya reportaste esta publicación'
            : 'Ya reportaste este usuario'
        );
      }
      lastReportAt.set(key, now);
      try {
        const { error } = await supabase.from('reports').insert({
          target_type: targetType,
          target_id: targetId,
          reason,
        });
        if (error) throw error;
      } catch (err) {
        lastReportAt.delete(key);
        throw err;
      }
    },
  });
}
