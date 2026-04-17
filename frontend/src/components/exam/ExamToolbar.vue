<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Lock, Send, Loader2, CheckCircle2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'

const { t } = useI18n()

const props = defineProps<{
  timeRemainingSeconds: number | null
  isTimerUrgent: boolean
  showSubmitButton: boolean
  isSubmitting: boolean
  isLocked: boolean
  isFinished: boolean
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
      variant="default"
      size="sm"
      :disabled="isSubmitting || isFinished"
      @click="emit('submitClicked')"
    >
      <Loader2 v-if="isSubmitting" class="mr-1.5 h-4 w-4 animate-spin" />
      <Send v-else class="mr-1.5 h-4 w-4" />
      {{ t(L.exam.toolbar.finish) }}
    </Button>

    <div
      v-if="isFinished && !isLocked"
      class="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
    >
      <CheckCircle2 class="h-3.5 w-3.5" />
      {{ t(L.exam.toolbar.finishedAwaiting) }}
    </div>

    <!-- Locked badge -->
    <div
      v-if="isLocked"
      class="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm border border-border text-muted-foreground"
    >
      <Lock class="h-3.5 w-3.5" />
      {{ t(L.exam.toolbar.submittedReadOnly) }}
    </div>
  </div>
</template>
