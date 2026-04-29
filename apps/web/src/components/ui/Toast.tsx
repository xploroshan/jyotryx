'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export type ToastTone = 'success' | 'error' | 'info';

/**
 * Persistent, dismissable feedback banner. Stays on-screen until the user
 * closes it or a timeout elapses — previously the app used inline messages
 * that auto-cleared after 3 s, which users on slower networks often missed.
 *
 * Render at most one Toast per logical region; compose higher-level screens
 * with conditional mounting.
 */
export function Toast({
  message,
  tone = 'info',
  onClose,
  autoCloseMs,
  action,
  closeLabel = 'Dismiss',
}: {
  message: string;
  tone?: ToastTone;
  onClose: () => void;
  autoCloseMs?: number;
  action?: { label: string; onClick: () => void };
  closeLabel?: string;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!autoCloseMs) return;
    const id = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(id);
  }, [autoCloseMs, onClose]);

  const toneClasses =
    tone === 'success'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : tone === 'error'
        ? 'bg-red-500/10 border-red-500/30 text-red-300'
        : 'bg-primary-500/10 border-primary-500/30 text-primary-300';

  return (
    <AnimatePresence>
      <motion.div
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live={tone === 'error' ? 'assertive' : 'polite'}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${toneClasses}`}
      >
        <span className="flex-1 leading-relaxed">{message}</span>
        <div className="flex items-center gap-2 shrink-0">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="focus-ring rounded-md px-2 py-1 text-xs font-medium underline underline-offset-2 hover:bg-[rgba(255,252,245,0.92)]"
            >
              {action.label}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="focus-ring rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * A visually prominent required-field asterisk. Accessible label conveys
 * "required" for screen readers without relying on color alone.
 */
export function RequiredMark({ label = 'required' }: { label?: string }) {
  return (
    <span className="ml-1 text-sm font-semibold text-accent-400" aria-label={label} title={label}>
      *
    </span>
  );
}
