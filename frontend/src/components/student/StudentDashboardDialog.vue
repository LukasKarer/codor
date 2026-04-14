<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BookOpen, CheckCircle2, CircleDashed, Loader2, MessageSquareText, Trophy, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { StudentDashboardExercise } from '@/lib/api'

const props = defineProps<{
  open: boolean
  exercises: StudentDashboardExercise[]
  loading: boolean
  error: string | null
  currentExerciseId: string | null
  switchingExerciseId: string | null
}>()

const emit = defineEmits<{
  close: []
  refresh: []
  selectExercise: [exerciseId: string]
}>()

const manualExerciseId = ref('')

const completedExercises = computed(() => props.exercises.filter((ex) => ex.is_completed))
const openExercises = computed(() => props.exercises.filter((ex) => !ex.is_completed))

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) manualExerciseId.value = ''
  },
)

function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return 'Not graded yet'
  return new Date(unixSeconds * 1000).toLocaleString()
}

function handleManualJoin() {
  const id = manualExerciseId.value.trim()
  if (!id) return
  emit('selectExercise', id)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <Card class="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden">
        <CardHeader class="border-b border-border pb-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <CardTitle class="flex items-center gap-2">
                <BookOpen class="h-5 w-5 text-primary" />
                Student Dashboard
              </CardTitle>
              <CardDescription>
                Review completed work, teacher feedback, and continue an open exercise.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" class="h-8 w-8" @click="emit('close')">
              <X class="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent class="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <div class="grid gap-3 md:grid-cols-[2fr_1fr]">
            <div class="space-y-2">
              <Label for="manual-exercise-id">Open by Exercise ID</Label>
              <div class="flex gap-2">
                <Input
                  id="manual-exercise-id"
                  v-model="manualExerciseId"
                  placeholder="e.g. abc123def456"
                  @keyup.enter="handleManualJoin"
                />
                <Button
                  :disabled="!manualExerciseId.trim() || switchingExerciseId !== null"
                  @click="handleManualJoin"
                >
                  Open
                </Button>
              </div>
            </div>
            <div class="flex items-end justify-end">
              <Button variant="outline" :disabled="loading" @click="emit('refresh')">Refresh</Button>
            </div>
          </div>

          <div v-if="loading" class="flex flex-1 items-center justify-center">
            <Loader2 class="h-6 w-6 animate-spin text-primary" />
          </div>

          <div v-else-if="error" class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {{ error }}
          </div>

          <div v-else class="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
            <div class="flex min-h-0 flex-col rounded-lg border border-border">
              <div class="border-b border-border px-4 py-3">
                <h3 class="flex items-center gap-2 text-sm font-semibold">
                  <CircleDashed class="h-4 w-4 text-amber-500" />
                  Open Exercises
                </h3>
              </div>
              <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-3 p-3">
                  <Card
                    v-for="exercise in openExercises"
                    :key="exercise.entry_sub"
                    class="border border-border"
                  >
                    <CardHeader class="pb-2">
                      <CardTitle class="text-base">{{ exercise.title }}</CardTitle>
                      <CardDescription>
                        Started {{ formatDate(exercise.creation_time) }}
                      </CardDescription>
                    </CardHeader>
                    <CardContent class="flex items-center justify-between pt-0">
                      <span
                        v-if="currentExerciseId === exercise.exercise_sub"
                        class="rounded-full border border-blue-400/40 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500"
                      >
                        Current in IDE
                      </span>
                      <span v-else class="text-xs text-muted-foreground">Not opened now</span>
                      <Button
                        size="sm"
                        :disabled="!exercise.exercise_sub || switchingExerciseId === exercise.exercise_sub"
                        @click="exercise.exercise_sub && emit('selectExercise', exercise.exercise_sub)"
                      >
                        <Loader2
                          v-if="switchingExerciseId === exercise.exercise_sub"
                          class="mr-1.5 h-3.5 w-3.5 animate-spin"
                        />
                        Open
                      </Button>
                    </CardContent>
                  </Card>
                  <p v-if="openExercises.length === 0" class="p-2 text-sm text-muted-foreground">
                    No open exercises.
                  </p>
                </div>
              </ScrollArea>
            </div>

            <div class="flex min-h-0 flex-col rounded-lg border border-border">
              <div class="border-b border-border px-4 py-3">
                <h3 class="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 class="h-4 w-4 text-emerald-500" />
                  Completed Exercises
                </h3>
              </div>
              <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-3 p-3">
                  <Card
                    v-for="exercise in completedExercises"
                    :key="exercise.entry_sub"
                    class="border border-border"
                  >
                    <CardHeader class="pb-2">
                      <CardTitle class="text-base">{{ exercise.title }}</CardTitle>
                      <CardDescription>
                        Finished {{ formatDate(exercise.submitted_at || exercise.creation_time) }}
                      </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-2 pt-0">
                      <div class="flex items-center gap-2 text-sm">
                        <Trophy class="h-4 w-4 text-amber-500" />
                        Score:
                        <span class="font-semibold">{{ exercise.score ?? 'Pending grading' }}</span>
                      </div>
                      <div class="flex items-start gap-2 text-sm text-muted-foreground">
                        <MessageSquareText class="mt-0.5 h-4 w-4 text-blue-500" />
                        <span>{{ exercise.teacher_feedback || 'No teacher feedback yet.' }}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <p v-if="completedExercises.length === 0" class="p-2 text-sm text-muted-foreground">
                    No completed exercises yet.
                  </p>
                </div>
              </ScrollArea>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </Teleport>
</template>
