<script setup lang="ts">
import { ref, watch } from 'vue'
import { User, Loader2, CheckCircle2 } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'
import { saveTeacherFeedback } from '@/lib/api'

const props = defineProps<{
  studentSub: string
  initialFeedback: string
}>()

const emit = defineEmits<{
  (e: 'saved', feedback: string): void
}>()

const feedback = ref(props.initialFeedback)
const isSaving = ref(false)

watch(() => props.initialFeedback, (newVal) => {
  feedback.value = newVal
})

const handleSave = async () => {
  if (!props.studentSub) return
  isSaving.value = true
  try {
    await saveTeacherFeedback(props.studentSub, feedback.value)
    emit('saved', feedback.value)
    toast.success('Feedback saved successfully')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to save feedback')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Card class="border-white/10 bg-[#09132b]/85 border-blue-500/30">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-2xl text-slate-100">
        <User class="h-6 w-6 text-blue-300" />
        Teacher Feedback
      </CardTitle>
      <CardDescription class="text-slate-400">
        Leave custom written feedback for this student's solution.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <Textarea
        v-model="feedback"
        placeholder="Write your feedback here..."
        class="min-h-[100px] border-white/20 bg-black/20 focus-visible:ring-blue-500"
      />
      <Button
        @click="handleSave"
        :disabled="isSaving"
        class="bg-blue-600 hover:bg-blue-700 text-white"
      >
        <Loader2 v-if="isSaving" class="mr-2 h-4 w-4 animate-spin" />
        <CheckCircle2 v-else class="mr-2 h-4 w-4" />
        Save Feedback
      </Button>
    </CardContent>
  </Card>
</template>
