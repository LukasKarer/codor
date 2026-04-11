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
  submitButton: 'Submit Exercise',
  lockedBadge: 'Submitted — read only',

  confirmDialog: {
    title: 'Submit Exercise?',
    description:
      'Once submitted, you cannot make further changes. Your current code will be saved as your final answer.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Yes, Submit',
  },

  timesUpDialog: {
    title: "Time's Up!",
    description:
      'Your code has been automatically submitted. The exercise is now locked.',
    closeLabel: 'OK',
  },

  chatDisabledSubmitted: 'Exercise submitted — AI chat disabled',
  chatDisabledExam: 'AI assistance is disabled for this exam',
  chatRestrictedHint: 'Get Help is available. Free chat is disabled for this exam.',
}
