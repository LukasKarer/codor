<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { User, Loader2, CheckCircle2, X } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import { saveTeacherFeedback } from '@/lib/api'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'

const { t } = useI18n()

const props = defineProps<{
  studentSub: string
  initialFeedback: string
}>()

const emit = defineEmits<{
  (e: 'saved', feedback: string): void
}>()

const feedback = ref(props.initialFeedback)
const savedFeedback = ref(props.initialFeedback)
const isSaving = ref(false)
const isSaved = ref(false)

const hasChanged = computed(() => feedback.value !== savedFeedback.value)

watch(() => props.initialFeedback, (newVal) => {
  feedback.value = newVal
  savedFeedback.value = newVal
})

const handleSave = async () => {
  if (!props.studentSub || !hasChanged.value) return
  isSaving.value = true
  try {
    await saveTeacherFeedback(props.studentSub, feedback.value)
    savedFeedback.value = feedback.value
    emit('saved', feedback.value)
    isSaved.value = true
    setTimeout(() => {
      isSaved.value = false
    }, 1500)
    toast.success('Feedback saved successfully')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to save feedback')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Card class="border-blue-500/30">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-2xl">
        <User class="h-6 w-6 text-blue-500 dark:text-blue-300" />
        {{ t(L.teacher.feedback.title) }}
      </CardTitle>
      <CardDescription>
        {{ t(L.teacher.feedback.description) }}
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <Textarea
        v-model="feedback"
        :placeholder="t(L.teacher.feedback.placeholder)"
        class="min-h-[100px] focus-visible:ring-blue-500"
      />
      <div class="flex gap-2">
      <Button
        variant="ghost"
        :disabled="!feedback"
        class="px-3"
        @click="feedback = ''"
      >
        <X class="h-4 w-4 mr-2" />
        {{ t(L.teacher.feedback.clear) }}
      </Button>
      <div class="flex-1" />
      <Button
        @click="handleSave"
        :disabled="isSaving || (!hasChanged && !isSaved)"
        :class="[
          'relative transition-colors duration-500 text-white',
          isSaved
            ? 'bg-green-500 hover:bg-green-500 disabled:bg-green-500 disabled:opacity-100'
            : 'bg-blue-600 hover:bg-blue-700',
        ]"
      >
        <!-- Invisible placeholder that always holds the full width -->
        <span class="inline-flex items-center opacity-0 select-none pointer-events-none" aria-hidden="true">
          <CheckCircle2 class="mr-2 h-4 w-4" />
          {{ t(L.teacher.feedback.save) }}
        </span>
        <!-- Animated content overlaid absolutely -->
        <span class="absolute inset-0 flex items-center justify-center">
          <Loader2 v-if="isSaving" class="h-4 w-4 animate-spin" />
          <CheckCircle2 v-else class="h-4 w-4 flex-shrink-0" />
          <span
            class="transition-all duration-300 overflow-hidden whitespace-nowrap"
            :class="isSaved ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100 ml-2'"
          >
            {{ t(L.teacher.feedback.save) }}
          </span>
        </span>
      </Button>
      </div>
    </CardContent>
  </Card>
</template>
