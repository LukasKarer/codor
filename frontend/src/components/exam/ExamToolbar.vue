<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Lock, Send, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { EXAM_STRINGS } from './constants'

const props = defineProps<{
  timeRemainingSeconds: number | null
  isTimerUrgent: boolean
  showSubmitButton: boolean
  isSubmitting: boolean
  isLocked: boolean
}>()

const emit = defineEmits<{ submitClicked: [] }>()

const isTimerVisible = computed(
  () => props.timeRemainingSeconds !== null,
)

const formattedTime = computed(() => {
  if (props.timeRemainingSeconds === null) return ''
  const totalSeconds = props.timeRemainingSeconds
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Countdown timer -->
    <div
      v-if="isTimerVisible"
      :class="[
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-mono font-semibold border',
        isTimerUrgent
          ? 'border-red-500 text-red-500 animate-pulse'
          : 'border-border text-foreground',
      ]"
    >
      <Clock class="h-3.5 w-3.5" />
      {{ formattedTime }}
    </div>

    <!-- Submit button -->
    <Button
      v-if="showSubmitButton"
      variant="destructive"
      size="sm"
      :disabled="isSubmitting"
      @click="emit('submitClicked')"
    >
      <Loader2 v-if="isSubmitting" class="mr-1.5 h-4 w-4 animate-spin" />
      <Send v-else class="mr-1.5 h-4 w-4" />
      {{ EXAM_STRINGS.submitButton }}
    </Button>

    <!-- Locked badge -->
    <div
      v-if="isLocked"
      class="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm border border-border text-muted-foreground"
    >
      <Lock class="h-3.5 w-3.5" />
      {{ EXAM_STRINGS.lockedBadge }}
    </div>
  </div>
</template>
