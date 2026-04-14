// ============================================================
// Exam mode constants
// ============================================================

// Timer thresholds
export const TIMER_URGENT_THRESHOLD_SECONDS = 120
export const DEFAULT_TIME_LIMIT_MINUTES = 60

// AI mode values
export const AI_MODE_ENABLED = 'enabled' as const
export const AI_MODE_RESTRICTED = 'restricted' as const
export const AI_MODE_DISABLED = 'disabled' as const

// UI strings
export const EXAM_STRINGS = {
  submitButton: 'Finish Exercise',
  finishedBadge: 'Finished - awaiting grading',
  lockedBadge: 'Submitted — read only',

  confirmDialog: {
    title: 'Finish Exercise?',
    description:
      'Your current code will be marked as finished and sent for teacher review. You can still edit until grading locks it.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Yes, Finish',
  },

  timesUpDialog: {
    title: "Time's Up!",
    description:
      'Your code was marked as finished automatically and sent for teacher review.',
    closeLabel: 'OK',
  },

  chatDisabledSubmitted: 'Exercise submitted — AI chat disabled',
  chatDisabledExam: 'AI assistance is disabled for this exam',
  chatRestrictedHint: 'Get Help is available. Free chat is disabled for this exam.',
}
