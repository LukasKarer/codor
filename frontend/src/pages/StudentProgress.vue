<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Code,
  ArrowLeft,
  User,
  Clock,
  MessageSquare,
  Award,
  Loader2,
  FlaskConical,
  Sparkles,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LanguageToggle from '@/components/LanguageToggle.vue'
import TeacherFeedbackCard from '@/components/TeacherFeedbackCard.vue'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'
import { toast } from 'vue-sonner'
import {
  getExerciseInfo,
  getAllParticipantsWithDetails,
  parseExerciseContent,
  getExerciseParticipantDetail,
  generateStudentReport,
  getExerciseReport,
  generateExerciseReport,
  type Participant,
  type ParticipantDetail,
  type ExerciseReport,
  type StudentReport,
} from '@/lib/api'

interface StudentSubmission {
  studentId: string
  studentName: string
  status: 'completed' | 'not-started'
  score: number | null
  hasContent: boolean
  isTest: boolean
  testLabel: string | null
  aiInteractionsCount: number
  timeSpentMinutes: number
  hasReport: boolean
  hasTeacherFeedback: boolean
}

interface Exercise {
  id: string
  title: string
  submissions: StudentSubmission[]
}

const { t } = useI18n()
const router = useRouter()
const selectedExercise = ref<string | null>(null)
const selectedStudent = ref<string | null>(null)
const exercises = ref<Exercise[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

const isLoadingDetail = ref(false)
const detailError = ref<string | null>(null)
const selectedStudentDetail = ref<ParticipantDetail | null>(null)

const isGeneratingStudentReport = ref(false)
const isGeneratingExerciseReport = ref(false)
const exerciseReport = ref<ExerciseReport | null>(null)
const exerciseReportError = ref<string | null>(null)

const selectedExerciseData = computed(
  () => exercises.value.find((e) => e.id === selectedExercise.value) ?? null,
)

const selectedStudentData = computed(
  () =>
    selectedExerciseData.value?.submissions.find((s) => s.studentId === selectedStudent.value) ??
    null,
)

const selectedStudentReport = computed<(StudentReport & { score: number }) | null>(
  () => (selectedStudentDetail.value?.report as (StudentReport & { score: number }) | null) ?? null,
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
            : p.name || `Student ${p.sub.slice(0, 6)}`
          return {
            studentId: p.sub,
            studentName: label,
            status: p.content ? 'completed' : 'not-started',
            score: p.report_score ?? p.note ?? null,
            hasContent: !!p.content,
            isTest: p.is_test,
            testLabel: p.test_label ?? null,
            aiInteractionsCount: p.ai_interactions_count ?? 0,
            timeSpentMinutes: p.time_spent_minutes ?? 0,
            hasReport: p.has_report ?? false,
            hasTeacherFeedback: !!p.teacher_feedback,
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

const loadExerciseReport = async () => {
  if (!selectedExercise.value) {
    exerciseReport.value = null
    return
  }

  exerciseReportError.value = null
  try {
    exerciseReport.value = await getExerciseReport(selectedExercise.value)
  } catch (e) {
    exerciseReport.value = null
    exerciseReportError.value = e instanceof Error ? e.message : 'Failed to load exercise report'
  }
}

const loadStudentDetail = async () => {
  if (!selectedExercise.value || !selectedStudent.value) {
    selectedStudentDetail.value = null
    detailError.value = null
    return
  }

  isLoadingDetail.value = true
  detailError.value = null
  try {
    selectedStudentDetail.value = await getExerciseParticipantDetail(
      selectedExercise.value,
      selectedStudent.value,
    )
  } catch (e) {
    selectedStudentDetail.value = null
    detailError.value = e instanceof Error ? e.message : 'Failed to load student details'
  } finally {
    isLoadingDetail.value = false
  }
}

const handleTeacherFeedbackSaved = (val: string) => {
  if (selectedStudentDetail.value) selectedStudentDetail.value.teacher_feedback = val
  const exercise = exercises.value.find((e) => e.id === selectedExercise.value)
  const sub = exercise?.submissions.find((s) => s.studentId === selectedStudent.value)
  if (sub) sub.hasTeacherFeedback = !!val
}

const generateSelectedStudentReport = async () => {
  if (!selectedExercise.value || !selectedStudent.value) return

  isGeneratingStudentReport.value = true
  detailError.value = null
  try {
    const report = await generateStudentReport(selectedExercise.value, selectedStudent.value)
    await loadStudentDetail()

    const exercise = exercises.value.find((e) => e.id === selectedExercise.value)
    const student = exercise?.submissions.find((s) => s.studentId === selectedStudent.value)
    if (student) {
      student.score = report.score
      student.aiInteractionsCount = report.ai_interactions_count
      student.timeSpentMinutes = report.time_spent_minutes
      student.hasReport = true
    }
  } catch (e) {
    detailError.value = e instanceof Error ? e.message : 'Failed to generate student report'
  } finally {
    isGeneratingStudentReport.value = false
  }
}

const generateCurrentExerciseReport = async () => {
  if (!selectedExercise.value) return

  isGeneratingExerciseReport.value = true
  exerciseReportError.value = null
  try {
    exerciseReport.value = await generateExerciseReport(selectedExercise.value)
  } catch (e) {
    exerciseReportError.value = e instanceof Error ? e.message : 'Failed to generate exercise report'
  } finally {
    isGeneratingExerciseReport.value = false
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500/15 text-green-500 border-green-500/30'
    default:
      return 'bg-amber-500/15 text-amber-400 border-amber-500/40'
  }
}

const getScoreColor = (score: number | null) => {
  if (score === null) return ''
  if (score >= 90) return 'text-green-400'
  if (score >= 70) return 'text-amber-300'
  return 'text-rose-300'
}

watch(selectedExercise, async () => {
  selectedStudent.value = null
  selectedStudentDetail.value = null
  detailError.value = null
  await loadExerciseReport()
})

watch(selectedStudent, async () => {
  await loadStudentDetail()
})

onMounted(async () => {
  await loadExercises()
  await loadExerciseReport()
})
</script>

<template>
  <div class="flex h-screen flex-col bg-[#050a1a] text-slate-100">
    <header class="border-b border-white/10 px-6 py-4 bg-[#070e22]">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            class="h-9 w-9 text-slate-200 hover:text-white hover:bg-white/10"
            @click="router.push('/teacher')"
          >
            <ArrowLeft class="h-5 w-5" />
          </Button>
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500"
          >
            <Code class="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 class="font-semibold">{{ t(L.progress.title) }}</h1>
            <p class="text-xs text-slate-400">{{ t(L.progress.subtitle) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main class="flex flex-1 overflow-hidden">
      <div v-if="isLoading" class="flex flex-1 items-center justify-center">
        <Loader2 class="h-8 w-8 animate-spin text-blue-300" />
      </div>

      <div v-else-if="error" class="flex flex-1 items-center justify-center">
        <div class="text-center">
          <p class="text-rose-300 mb-4">{{ error }}</p>
          <Button @click="loadExercises">{{ t(L.progress.retry) }}</Button>
        </div>
      </div>

      <div v-else-if="exercises.length === 0" class="flex flex-1 items-center justify-center">
        <div class="text-center">
          <Code class="mx-auto h-12 w-12 text-slate-500" />
          <h3 class="mt-4 text-lg font-semibold">{{ t(L.progress.noExercises) }}</h3>
          <p class="mt-2 text-sm text-slate-400">{{ t(L.progress.noExercisesDescription) }}</p>
          <Button class="mt-4" @click="router.push('/teacher/upload')">{{ t(L.progress.createExercise) }}</Button>
        </div>
      </div>

      <template v-else>
        <div class="w-80 border-r border-white/10 overflow-auto p-4 space-y-3">
          <h2 class="text-sm font-semibold text-slate-400 mb-3 px-2">{{ t(L.progress.exercises) }}</h2>
          <Card
            v-for="exercise in exercises"
            :key="exercise.id"
            :class="[
              'cursor-pointer border bg-[#09132b]/85 transition-all hover:border-blue-400/50',
              selectedExercise === exercise.id
                ? 'border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,0.4)]'
                : 'border-white/10',
            ]"
            @click="selectedExercise = selectedExercise === exercise.id ? null : exercise.id"
          >
            <CardHeader class="pb-3">
              <CardTitle class="text-base text-slate-100">{{ exercise.title }}</CardTitle>
              <CardDescription class="flex items-center gap-2 text-xs text-slate-400">
                <User class="h-3 w-3" />
                {{ exercise.submissions.filter(s => !s.isTest).length }} {{ t(L.progress.students) }}
                <span v-if="exercise.submissions.some(s => s.isTest)" class="text-orange-300">
                  + {{ exercise.submissions.filter(s => s.isTest).length }} {{ t(L.progress.test) }}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent class="pt-0">
              <div class="flex items-center justify-between text-xs text-slate-400">
                <span>{{ t(L.progress.completed) }}</span>
                <span class="font-semibold text-indigo-300">
                  {{ exercise.submissions.filter((s) => s.status === 'completed').length }}/{{
                    exercise.submissions.length
                  }}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div v-if="selectedExerciseData" class="w-96 border-r border-white/10 overflow-auto p-4 space-y-3">
          <h2 class="text-sm font-semibold text-slate-400 mb-3 px-2">{{ t(L.progress.studentsLabel) }}</h2>
          <Card
            v-for="submission in selectedExerciseData.submissions"
            :key="submission.studentId"
            :class="[
              'cursor-pointer border transition-all',
              submission.isTest ? 'bg-orange-950/20 border-orange-500/30' : 'bg-[#09132b]/85 border-white/10',
              selectedStudent === submission.studentId
                ? 'border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,0.4)]'
                : 'hover:border-blue-400/40',
            ]"
            @click="selectedStudent = selectedStudent === submission.studentId ? null : submission.studentId"
          >
            <CardHeader>
              <div class="flex items-start justify-between gap-2">
                <CardTitle class="text-base truncate flex items-start gap-1.5 text-slate-100">
                  <FlaskConical
                    v-if="submission.isTest"
                    class="h-3.5 w-3.5 flex-shrink-0 text-orange-300"
                  />
                  {{ submission.studentName }}
                </CardTitle>
                <div class="flex flex-col items-end gap-1">
                  <span
                    :class="[
                      'rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                      getStatusColor(submission.status),
                    ]"
                  >
                    {{ submission.status.replace('-', ' ') }}
                  </span>
                  <span
                    v-if="submission.hasTeacherFeedback"
                    class="rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400 whitespace-nowrap"
                  >
                    {{ t(L.progress.feedback) }}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent class="pt-0 space-y-2 text-slate-300">
              <div class="flex items-center gap-2 text-xs">
                <Clock class="h-3 w-3" />
                {{ submission.timeSpentMinutes }} {{ t(L.progress.min) }}
              </div>
              <div class="flex items-center gap-2 text-xs">
                <MessageSquare class="h-3 w-3" />
                {{ submission.aiInteractionsCount }} {{ t(L.progress.aiChats) }}
              </div>
              <div v-if="submission.score !== null" class="flex items-center gap-2 text-xs">
                <Award class="h-3 w-3 text-indigo-300" />
                <span :class="['font-semibold', getScoreColor(submission.score)]">
                  {{ submission.score }}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div class="flex-1 overflow-auto p-6">
          <div v-if="selectedStudentData" class="mx-auto max-w-4xl space-y-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-2xl font-bold text-slate-100">{{ selectedStudentData.studentName }}</h2>
                  <span
                    v-if="selectedStudentData.isTest"
                    class="rounded-full border border-orange-400/60 bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-300"
                  >
                    {{ t(L.progress.testSession) }}
                  </span>
                </div>
                <p class="text-slate-400 text-lg">{{ selectedExerciseData?.title }}</p>
              </div>
              <Button
                class="bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                :disabled="isGeneratingStudentReport"
                @click="generateSelectedStudentReport"
              >
                <Loader2 v-if="isGeneratingStudentReport" class="mr-2 h-4 w-4 animate-spin" />
                <Sparkles v-else class="mr-2 h-4 w-4" />
                {{ t(L.progress.generateReport) }}
              </Button>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader class="pb-3">
                  <CardDescription class="flex items-center gap-2 text-xs text-slate-400">
                    <Clock class="h-4 w-4" />
                    {{ t(L.progress.timeSpent) }}
                  </CardDescription>
                  <CardTitle class="text-2xl text-slate-100">
                    {{ selectedStudentDetail?.time_spent_minutes ?? selectedStudentData.timeSpentMinutes }} {{ t(L.progress.min) }}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader class="pb-3">
                  <CardDescription class="flex items-center gap-2 text-xs text-slate-400">
                    <MessageSquare class="h-4 w-4" />
                    {{ t(L.progress.aiInteractions) }}
                  </CardDescription>
                  <CardTitle class="text-2xl text-slate-100">
                    {{ selectedStudentDetail?.ai_interactions_count ?? selectedStudentData.aiInteractionsCount }}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader class="pb-3">
                  <CardDescription class="flex items-center gap-2 text-xs text-slate-400">
                    <Award class="h-4 w-4" />
                    {{ t(L.progress.score) }}
                  </CardDescription>
                  <CardTitle :class="['text-2xl', getScoreColor(selectedStudentReport?.score ?? selectedStudentData.score)]">
                    {{ selectedStudentReport?.score ?? selectedStudentData.score ?? 'N/A' }}
                    <span v-if="selectedStudentReport?.score !== undefined || selectedStudentData.score !== null">%</span>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div v-if="isLoadingDetail" class="flex items-center gap-2 text-slate-300">
              <Loader2 class="h-4 w-4 animate-spin" />
              {{ t(L.progress.loadingDetails) }}
            </div>

            <div v-else-if="detailError" class="rounded-lg border border-rose-400/40 bg-rose-950/20 p-4 text-rose-200">
              {{ detailError }}
            </div>

            <template v-else>
              <TeacherFeedbackCard
                :student-sub="selectedStudentData.studentId"
                :initial-feedback="selectedStudentDetail?.teacher_feedback || ''"
                @saved="handleTeacherFeedbackSaved"
              />
              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader>
                  <CardTitle class="flex items-center gap-2 text-2xl text-slate-100">
                    <MessageSquare class="h-6 w-6 text-indigo-300" />
                    {{ t(L.progress.aiInteractionsTitle) }}
                  </CardTitle>
                  <CardDescription class="text-slate-400 text-lg">
                    {{ t(L.progress.aiInteractionsDescription) }}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    v-if="selectedStudentReport?.ai_interactions?.length"
                    class="space-y-4 text-slate-200"
                  >
                    <div
                      v-for="(item, idx) in selectedStudentReport.ai_interactions"
                      :key="`report-ai-${idx}`"
                      class="flex items-start gap-3"
                    >
                      <span
                        class="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-semibold text-indigo-200"
                      >
                        {{ idx + 1 }}
                      </span>
                      <p>{{ item }}</p>
                    </div>
                  </div>
                  <div
                    v-else-if="selectedStudentDetail?.conversations?.length"
                    class="space-y-4 text-slate-200"
                  >
                    <div
                      v-for="(item, idx) in selectedStudentDetail.conversations"
                      :key="item.id"
                      class="rounded-md border border-white/10 bg-white/5 p-3"
                    >
                      <p class="text-xs uppercase tracking-wide text-slate-400 mb-1">{{ item.prompt_type }}</p>
                      <p v-if="item.user_message" class="text-sm text-slate-300">Q: {{ item.user_message }}</p>
                      <p class="text-sm text-slate-100">A: {{ item.assistant_message }}</p>
                    </div>
                    <p class="text-xs text-slate-400">{{ t(L.progress.aiInteractionsNote) }}</p>
                  </div>
                  <p v-else class="text-sm text-slate-400">
                    {{ t(L.progress.noAiInteractions) }}
                  </p>
                </CardContent>
              </Card>

              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader>
                  <CardTitle class="flex items-center gap-2 text-2xl text-slate-100">
                    <AlertCircle class="h-6 w-6 text-rose-300" />
                    {{ t(L.progress.scoreDeductions) }}
                  </CardTitle>
                  <CardDescription class="text-slate-400 text-lg">
                    {{ t(L.progress.scoreDeductionsDescription) }}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    v-if="selectedStudentReport?.score_deductions?.length"
                    class="space-y-3"
                  >
                    <div
                      v-for="(deduction, idx) in selectedStudentReport.score_deductions"
                      :key="`deduction-${idx}`"
                      class="flex items-center justify-between rounded-md border border-rose-500/40 bg-rose-950/20 px-3 py-3 text-rose-100"
                    >
                      <div class="flex items-center gap-3">
                        <span
                          class="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/30 text-xs font-semibold"
                        >
                          {{ idx + 1 }}
                        </span>
                        <span>{{ deduction.reason }}</span>
                      </div>
                      <span class="font-semibold">-{{ deduction.points }} {{ t(L.progress.pts) }}</span>
                    </div>
                    <div class="mt-3 flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-3 text-slate-100">
                      <span class="font-semibold">{{ t(L.progress.totalPointsLost) }}</span>
                      <span class="font-semibold text-rose-300">-
                        {{
                          selectedStudentReport.total_points_lost ??
                          selectedStudentReport.score_deductions.reduce((sum, d) => sum + d.points, 0)
                        }}
                        {{ t(L.progress.pts) }}
                      </span>
                    </div>
                  </div>
                  <p v-else class="text-sm text-slate-400">
                    {{ t(L.progress.noReport) }}
                  </p>
                </CardContent>
              </Card>
            </template>
          </div>

          <div v-else class="mx-auto max-w-4xl space-y-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-3xl font-bold text-slate-100">{{ t(L.progress.exerciseReport) }}</h2>
                <p class="text-slate-400">{{ t(L.progress.exerciseReportDescription) }}</p>
              </div>
              <Button
                class="bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                :disabled="isGeneratingExerciseReport || !selectedExercise"
                @click="generateCurrentExerciseReport"
              >
                <Loader2 v-if="isGeneratingExerciseReport" class="mr-2 h-4 w-4 animate-spin" />
                <ClipboardList v-else class="mr-2 h-4 w-4" />
                {{ t(L.progress.generateReport) }}
              </Button>
            </div>

            <div v-if="exerciseReportError" class="rounded-lg border border-rose-400/40 bg-rose-950/20 p-4 text-rose-200">
              {{ exerciseReportError }}
            </div>

            <template v-else-if="exerciseReport">
              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader>
                  <CardTitle class="text-2xl text-slate-100">{{ t(L.progress.overview) }}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p class="text-slate-200">{{ exerciseReport.overview }}</p>
                </CardContent>
              </Card>

              <div class="grid gap-4 md:grid-cols-3">
                <Card class="border-white/10 bg-[#09132b]/85">
                  <CardHeader class="pb-2">
                    <CardDescription class="text-slate-400">{{ t(L.progress.averageScore) }}</CardDescription>
                    <CardTitle class="text-3xl text-slate-100">{{ exerciseReport.score_distribution.avg }}%</CardTitle>
                  </CardHeader>
                </Card>
                <Card class="border-white/10 bg-[#09132b]/85">
                  <CardHeader class="pb-2">
                    <CardDescription class="text-slate-400">{{ t(L.progress.lowestScore) }}</CardDescription>
                    <CardTitle class="text-3xl text-rose-300">{{ exerciseReport.score_distribution.min }}%</CardTitle>
                  </CardHeader>
                </Card>
                <Card class="border-white/10 bg-[#09132b]/85">
                  <CardHeader class="pb-2">
                    <CardDescription class="text-slate-400">{{ t(L.progress.highestScore) }}</CardDescription>
                    <CardTitle class="text-3xl text-green-300">{{ exerciseReport.score_distribution.max }}%</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader>
                  <CardTitle class="flex items-center gap-2 text-slate-100">
                    <CheckCircle2 class="h-5 w-5 text-green-300" />
                    {{ t(L.progress.classStrengths) }}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul class="space-y-2 text-slate-200">
                    <li v-for="(item, idx) in exerciseReport.class_strengths" :key="`strength-${idx}`">
                      - {{ item }}
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader>
                  <CardTitle class="flex items-center gap-2 text-slate-100">
                    <AlertCircle class="h-5 w-5 text-amber-300" />
                    {{ t(L.progress.classImprovements) }}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul class="space-y-2 text-slate-200">
                    <li v-for="(item, idx) in exerciseReport.class_improvements" :key="`improvement-${idx}`">
                      - {{ item }}
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card class="border-white/10 bg-[#09132b]/85">
                <CardHeader>
                  <CardTitle class="text-slate-100">{{ t(L.progress.perStudentHighlights) }}</CardTitle>
                </CardHeader>
                <CardContent class="space-y-2">
                  <div
                    v-for="(item, idx) in exerciseReport.per_student_highlights"
                    :key="`highlight-${idx}`"
                    class="rounded-md border border-white/10 bg-white/5 p-3"
                  >
                    <p class="text-sm text-slate-200">
                      <span class="font-semibold text-slate-100">{{ item.student_sub }}</span>
                      ({{ item.score }}%) - {{ item.highlight }}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </template>

            <div v-else class="flex h-[50vh] items-center justify-center">
              <div class="text-center">
                <User class="mx-auto h-12 w-12 text-slate-500" />
                <h3 class="mt-4 text-lg font-semibold text-slate-100">{{ t(L.progress.noStudentSelected) }}</h3>
                <p class="mt-2 text-sm text-slate-400">{{ t(L.progress.noStudentSelectedDescription) }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
