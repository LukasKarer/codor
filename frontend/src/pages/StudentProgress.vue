<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Code, ArrowLeft, User, Clock, MessageSquare, Award, Loader2, FlaskConical,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ThemeToggle from '@/components/ThemeToggle.vue'
import {
  getExerciseInfo,
  getAllParticipantsWithDetails,
  parseExerciseContent,
  type Participant,
} from '@/lib/api'

interface StudentSubmission {
  studentId: string
  studentName: string
  status: 'completed' | 'not-started'
  score: number | null
  hasContent: boolean
  isTest: boolean
  testLabel: string | null
}

interface Exercise {
  id: string
  title: string
  submissions: StudentSubmission[]
}

const router = useRouter()
const selectedExercise = ref<string | null>(null)
const selectedStudent = ref<string | null>(null)
const exercises = ref<Exercise[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const selectedExerciseData = computed(
  () => exercises.value.find((e) => e.id === selectedExercise.value) ?? null,
)

const selectedStudentData = computed(
  () =>
    selectedExerciseData.value?.submissions.find((s) => s.studentId === selectedStudent.value) ??
    null,
)

const loadExercises = async () => {
  isLoading.value = true
  error.value = null
  try {
    const lastExerciseId = localStorage.getItem('lastCreatedExerciseId')
    const savedExerciseIds = localStorage.getItem('exerciseIds')

    const exerciseIds: string[] = []
    if (lastExerciseId) exerciseIds.push(lastExerciseId)
    if (savedExerciseIds) {
      try {
        const ids = JSON.parse(savedExerciseIds) as string[]
        exerciseIds.push(...ids.filter((id) => id !== lastExerciseId))
      } catch (e) {
        console.error('Failed to parse saved exercise IDs', e)
      }
    }

    if (exerciseIds.length === 0) {
      error.value = 'No exercises found. Please create an exercise first.'
      isLoading.value = false
      return
    }

    const loaded: Exercise[] = []

    for (const exerciseId of exerciseIds) {
      try {
        const exerciseInfo = await getExerciseInfo(exerciseId)
        const parsedContent = parseExerciseContent(exerciseInfo.content)
        const participants = await getAllParticipantsWithDetails(exerciseId)

        const submissions: StudentSubmission[] = participants.map((p: Participant) => {
          const label = p.is_test
            ? (p.test_label ?? 'Teacher test')
            : `Student ${p.sub.slice(0, 6)}`
          return {
            studentId: p.sub,
            studentName: label,
            status: p.content ? 'completed' : 'not-started',
            score: p.note ?? null,
            hasContent: !!p.content,
            isTest: p.is_test,
            testLabel: p.test_label ?? null,
          }
        })

        loaded.push({ id: exerciseId, title: parsedContent.title, submissions })
      } catch (e) {
        console.error(`Failed to load exercise ${exerciseId}`, e)
      }
    }

    exercises.value = loaded
    if (loaded.length > 0 && !selectedExercise.value) {
      selectedExercise.value = loaded[0]!.id
    }
  } catch (e) {
    console.error('Failed to load exercises:', e)
    error.value = e instanceof Error ? e.message : 'Failed to load exercises'
  } finally {
    isLoading.value = false
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/40'
    case 'in-progress':
      return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/40'
    default:
      return 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/40'
  }
}

const getScoreColor = (score: number | null) => {
  if (score === null) return ''
  if (score >= 90) return 'text-green-600 dark:text-green-400'
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

onMounted(() => {
  loadExercises()
})
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- Header -->
    <header class="border-b border-border px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" class="h-9 w-9" @click="router.push('/teacher')">
            <ArrowLeft class="h-5 w-5" />
          </Button>
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500"
          >
            <Code class="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 class="font-semibold text-foreground">Student Progress</h1>
            <p class="text-xs text-muted-foreground">Track and analyze student performance</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex flex-1 overflow-hidden">
      <!-- Loading -->
      <div v-if="isLoading" class="flex flex-1 items-center justify-center">
        <Loader2 class="h-8 w-8 animate-spin text-primary" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-1 items-center justify-center">
        <div class="text-center">
          <p class="text-destructive mb-4">{{ error }}</p>
          <Button @click="loadExercises">Retry</Button>
        </div>
      </div>

      <!-- No exercises -->
      <div v-else-if="exercises.length === 0" class="flex flex-1 items-center justify-center">
        <div class="text-center">
          <Code class="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 class="mt-4 text-lg font-semibold text-foreground">No exercises found</h3>
          <p class="mt-2 text-sm text-muted-foreground">
            Create an exercise first to view student progress
          </p>
          <Button class="mt-4" @click="router.push('/teacher/upload')">Create Exercise</Button>
        </div>
      </div>

      <!-- Content -->
      <template v-else>
        <!-- Left Sidebar: Exercise List -->
        <div class="w-80 border-r border-border overflow-auto p-4 space-y-2">
          <h2 class="text-sm font-semibold text-muted-foreground mb-3 px-2">EXERCISES</h2>
          <Card
            v-for="exercise in exercises"
            :key="exercise.id"
            :class="[
              'cursor-pointer transition-all hover:scale-[1.02] backdrop-blur-md bg-white/40 dark:bg-slate-900/40',
              selectedExercise === exercise.id
                ? 'border-primary shadow-lg shadow-primary/20'
                : 'hover:border-primary/50',
            ]"
            @click="
              () => {
                selectedExercise = exercise.id
                selectedStudent = null
              }
            "
          >
            <CardHeader class="pb-3">
              <CardTitle class="text-base">{{ exercise.title }}</CardTitle>
              <CardDescription class="flex items-center gap-2 text-xs">
                <User class="h-3 w-3" />
                {{ exercise.submissions.filter(s => !s.isTest).length }} students
                <span v-if="exercise.submissions.some(s => s.isTest)" class="text-orange-500">
                  + {{ exercise.submissions.filter(s => s.isTest).length }} test
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent class="pt-0">
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">Completed</span>
                <span class="font-semibold text-primary">
                  {{ exercise.submissions.filter((s) => s.status === 'completed').length }}/{{
                    exercise.submissions.length
                  }}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Middle: Student List -->
        <div
          v-if="selectedExerciseData"
          class="w-96 border-r border-border overflow-auto p-4 space-y-2"
        >
          <h2 class="text-sm font-semibold text-muted-foreground mb-3 px-2">STUDENTS</h2>
          <Card
            v-for="submission in selectedExerciseData.submissions"
            :key="submission.studentId"
            :class="[
              'cursor-pointer transition-all hover:scale-[1.02] backdrop-blur-md',
              submission.isTest
                ? 'bg-orange-50/40 dark:bg-orange-950/20'
                : 'bg-white/40 dark:bg-slate-900/40',
              selectedStudent === submission.studentId
                ? 'border-primary shadow-lg shadow-primary/20'
                : 'hover:border-primary/50',
            ]"
            @click="selectedStudent = submission.studentId"
          >
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between gap-2">
                <CardTitle class="text-base truncate flex items-center gap-1.5">
                  <FlaskConical v-if="submission.isTest" class="h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                  {{ submission.studentName }}
                </CardTitle>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    v-if="submission.isTest"
                    class="rounded-full border border-orange-400/60 bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400"
                  >
                    TEST
                  </span>
                  <span
                    :class="[
                      'rounded-full border px-2 py-0.5 text-xs font-medium',
                      getStatusColor(submission.status),
                    ]"
                  >
                    {{ submission.status.replace('-', ' ') }}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent class="pt-0 space-y-2">
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock class="h-3 w-3" />
                N/A
              </div>
              <div v-if="submission.score !== null" class="flex items-center gap-2 text-xs">
                <Award class="h-3 w-3 text-primary" />
                <span :class="['font-semibold', getScoreColor(submission.score)]">
                  {{ submission.score }}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Right: Student Details -->
        <div class="flex-1 overflow-auto p-6">
          <div v-if="selectedStudentData" class="mx-auto max-w-3xl space-y-6">
            <div class="flex items-start gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-2xl font-bold text-foreground">
                    {{ selectedStudentData.studentName }}
                  </h2>
                  <span
                    v-if="selectedStudentData.isTest"
                    class="rounded-full border border-orange-400/60 bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400"
                  >
                    TEST SESSION
                  </span>
                </div>
                <p class="text-muted-foreground">{{ selectedExerciseData?.title }}</p>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid gap-4 md:grid-cols-2">
              <Card class="backdrop-blur-md bg-white/40 dark:bg-slate-900/40">
                <CardHeader class="pb-3">
                  <CardDescription class="flex items-center gap-2 text-xs">
                    <MessageSquare class="h-4 w-4" />
                    Submission Status
                  </CardDescription>
                  <CardTitle class="text-xl">
                    {{ selectedStudentData.hasContent ? 'Has submission' : 'No submission yet' }}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card class="backdrop-blur-md bg-white/40 dark:bg-slate-900/40">
                <CardHeader class="pb-3">
                  <CardDescription class="flex items-center gap-2 text-xs">
                    <Award class="h-4 w-4" />
                    Score
                  </CardDescription>
                  <CardTitle :class="['text-2xl', getScoreColor(selectedStudentData.score)]">
                    {{
                      selectedStudentData.score !== null ? `${selectedStudentData.score}%` : 'N/A'
                    }}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          </div>

          <div v-else class="flex h-full items-center justify-center">
            <div class="text-center">
              <User class="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 class="mt-4 text-lg font-semibold text-foreground">No student selected</h3>
              <p class="mt-2 text-sm text-muted-foreground">
                Select a student from the list to view their progress
              </p>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
