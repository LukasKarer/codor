<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Code, GraduationCap, LayoutDashboard, Loader2, X } from 'lucide-vue-next'
import ExamToolbar from '@/components/exam/ExamToolbar.vue'
import SubmitConfirmDialog from '@/components/exam/SubmitConfirmDialog.vue'
import TimesUpDialog from '@/components/exam/TimesUpDialog.vue'
import StudentDashboardDialog from '@/components/student/StudentDashboardDialog.vue'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import CodeEditor from '@/components/CodeEditor.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LanguageToggle from '@/components/LanguageToggle.vue'
import UserMenu from '@/components/UserMenu.vue'
import { Button } from '@/components/ui/button'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth'
import { useExerciseStore } from '@/stores/exercise'
import {
  getExerciseInfo,
  parseExerciseContent,
  enrollUser,
  pushExerciseContent,
  submitExercise,
  getConfig,
  getStudentDashboard,
  type StudentDashboardExercise,
} from '@/lib/api'
import type { ExamSettings } from '@/lib/api'
import { TIMER_URGENT_THRESHOLD_SECONDS } from '@/components/exam/constants'
import { supabase } from '@/lib/supabase'

const { t } = useI18n()
const authStore = useAuthStore()
const exerciseStore = useExerciseStore()
const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const error = ref<string | null>(null)
const exerciseTitle = ref('')

// Student dashboard state
const showStudentDashboard = ref(false)
const dashboardExercises = ref<StudentDashboardExercise[]>([])
const dashboardLoading = ref(false)
const dashboardError = ref<string | null>(null)
const switchingExerciseId = ref<string | null>(null)

// Exam mode state
const examSettings = ref<ExamSettings | null>(null)
const showSubmitConfirmDialog = ref(false)
const showTimesUpDialog = ref(false)
const isSubmitting = ref(false)
const timeRemainingSeconds = ref<number | null>(null)
let timerIntervalId: ReturnType<typeof setInterval> | null = null

const isTimerActive = computed(
  () => examSettings.value?.timeLimitMinutes != null && timeRemainingSeconds.value !== null,
)
const isTimerUrgent = computed(
  () =>
    timeRemainingSeconds.value !== null &&
    timeRemainingSeconds.value <= TIMER_URGENT_THRESHOLD_SECONDS,
)
const showSubmitButton = computed(
  () => !exerciseStore.isExerciseLocked && !exerciseStore.isFinished,
)

function stopExamTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId)
    timerIntervalId = null
  }
}

async function performSubmit() {
  if (!exerciseStore.exerciseId || exerciseStore.isExerciseLocked || exerciseStore.isFinished) return
  isSubmitting.value = true
  stopExamTimer()
  try {
    const result = await submitExercise(exerciseStore.exerciseId, exerciseStore.code)
    exerciseStore.isFinished = result.is_finished === true
    exerciseStore.submittedAt = result.submitted_at ?? null
    if (result.submitted_at !== null) {
      exerciseStore.isExerciseLocked = true
    }
  } catch (submitError: unknown) {
    const message = submitError instanceof Error ? submitError.message : ''
    if (message.includes('423')) {
      exerciseStore.isFinished = true
      exerciseStore.isExerciseLocked = true
    } else {
      isSubmitting.value = false
      throw submitError
    }
  } finally {
    isSubmitting.value = false
  }
}

async function handleTimerExpiry() {
  if (exerciseStore.isExerciseLocked) return
  try {
    await performSubmit()
  } catch (e) {
    console.error('Auto-submit failed at timer expiry:', e)
  } finally {
    showTimesUpDialog.value = true
  }
}

function startExamTimer(entryCreationTimeSec: number, timeLimitMinutes: number) {
  const deadlineMs = (entryCreationTimeSec + timeLimitMinutes * 60) * 1000
  function tick() {
    const remaining = Math.floor((deadlineMs - Date.now()) / 1000)
    if (remaining <= 0) {
      timeRemainingSeconds.value = 0
      stopExamTimer()
      handleTimerExpiry()
    } else {
      timeRemainingSeconds.value = remaining
    }
  }
  tick()
  timerIntervalId = setInterval(tick, 1000)
}

// Auto-save interval
let saveInterval: ReturnType<typeof setInterval> | null = null

const startAutoSave = () => {
  if (saveInterval) clearInterval(saveInterval)
  saveInterval = setInterval(async () => {
    if (!exerciseStore.exerciseId || !exerciseStore.code) return
    if (exerciseStore.isExerciseLocked) return
    try {
      await pushExerciseContent(exerciseStore.exerciseId, exerciseStore.code)
      console.log('[AutoSave] Code pushed')
    } catch (e) {
      console.error('[AutoSave] Push failed:', e)
    }
  }, exerciseStore.pushIntervalMs)
}

const loadStudentDashboardData = async () => {
  dashboardLoading.value = true
  dashboardError.value = null
  try {
    const dashboard = await getStudentDashboard()
    dashboardExercises.value = dashboard.exercises
  } catch (e) {
    dashboardError.value = e instanceof Error ? e.message : 'Failed to load dashboard'
  } finally {
    dashboardLoading.value = false
  }
}

const openStudentDashboard = async () => {
  showStudentDashboard.value = true
  await loadStudentDashboardData()
}

const flushCurrentProgress = async () => {
  if (!exerciseStore.exerciseId || !exerciseStore.code || exerciseStore.isExerciseLocked) return
  await pushExerciseContent(exerciseStore.exerciseId, exerciseStore.code)
}

watch(
  () => exerciseStore.userId,
  (val) => {
    if (val) startAutoSave()
    else if (saveInterval) clearInterval(saveInterval)
  },
)

onUnmounted(() => {
  if (saveInterval) clearInterval(saveInterval)
  stopExamTimer()
})

const loadExercise = async (overrideId?: string) => {
  isLoading.value = true
  error.value = null

  try {
    // Fetch push interval from backend config
    try {
      const config = await getConfig()
      exerciseStore.pushIntervalMs = config.pushIntervalMs
    } catch {
      // keep default
    }

    const urlExerciseId = route.query.exercise_id as string | undefined
    const storedExerciseId = localStorage.getItem('currentExerciseId')
    const isTestMode = route.query.test === '1'

    const targetExerciseId = overrideId || urlExerciseId || storedExerciseId

    if (!targetExerciseId) {
      await loadStudentDashboardData()
      showStudentDashboard.value = true
      isLoading.value = false
      return
    }

    // Load exercise content
    let exerciseInfo
    try {
      exerciseInfo = await getExerciseInfo(targetExerciseId)
    } catch (e) {
      localStorage.removeItem('currentExerciseId')
      showStudentDashboard.value = true
      await loadStudentDashboardData()
      dashboardError.value =
        e instanceof Error && e.message.toLowerCase().includes('404')
          ? 'Exercise not found. Please check the ID and try again.'
          : e instanceof Error
            ? e.message
            : 'Failed to load exercise'
      isLoading.value = false
      return
    }

    const parsedContent = parseExerciseContent(exerciseInfo.content)

    stopExamTimer()
    exerciseStore.resetForExerciseSwitch()

    exerciseStore.exerciseId = null
    exerciseStore.userId = null
    exerciseStore.examSettings = null
    exerciseStore.code = ''
    exerciseStore.exerciseDescription = ''

    exerciseStore.exerciseId = targetExerciseId
    exerciseStore.exerciseDescription = parsedContent.description
    exerciseStore.steps = parsedContent.steps ?? []
    exerciseTitle.value = parsedContent.title
    exerciseStore.code = ''

    // Hydrate exam settings before enrolling so the timer starts correctly
    examSettings.value = parsedContent.examSettings ?? null
    exerciseStore.examSettings = parsedContent.examSettings ?? null

    // Enroll the authenticated user (idempotent for non-test sessions).
    // The response includes saved_content — the student's last pushed code — so
    // we can restore the editor exactly where they left off.
    const enrollment = await enrollUser(targetExerciseId, isTestMode)
    exerciseStore.userId = enrollment.sub
    exerciseStore.entryCreationTime = enrollment.creation_time
    exerciseStore.submittedAt = enrollment.submitted_at ?? null
    exerciseStore.isFinished = enrollment.is_finished

    if (enrollment.saved_content) {
      exerciseStore.code = enrollment.saved_content
    }

    if (enrollment.submitted_at !== null) {
      exerciseStore.isExerciseLocked = true
    } else if (parsedContent.examSettings?.timeLimitMinutes && !enrollment.is_finished) {
      startExamTimer(enrollment.creation_time, parsedContent.examSettings.timeLimitMinutes)
    }

    localStorage.setItem('currentExerciseId', targetExerciseId)

    showStudentDashboard.value = false
    isLoading.value = false
  } catch (e) {
    console.error('Failed to load exercise:', e)
    error.value = e instanceof Error ? e.message : 'Failed to load exercise'
    isLoading.value = false
  }
}

const handleSelectExercise = async (exerciseId: string) => {
  if (!exerciseId.trim()) return
  if (exerciseStore.exerciseId === exerciseId) {
    showStudentDashboard.value = false
    return
  }

  switchingExerciseId.value = exerciseId
  dashboardError.value = null
  try {
    await flushCurrentProgress()
    await loadExercise(exerciseId)
    await loadStudentDashboardData()
  } catch (e) {
    dashboardError.value = e instanceof Error ? e.message : 'Failed to switch exercise'
  } finally {
    switchingExerciseId.value = null
  }
}

const handleSignOut = async () => {
  await supabase.auth.signOut()
  authStore.logout()
  showStudentDashboard.value = false
  dashboardExercises.value = []
  exerciseStore.userId = null
  exerciseStore.exerciseId = null
  localStorage.removeItem('currentExerciseId')
  router.push('/login')
}

const handleDashboardClose = () => {
  if (!exerciseStore.exerciseId) return
  showStudentDashboard.value = false
}

onMounted(() => {
  loadExercise()
})
</script>

<template>
  <!-- Loading -->
  <div v-if="isLoading" class="flex h-screen items-center justify-center bg-background">
    <Loader2 class="h-8 w-8 animate-spin text-primary" />
  </div>

  <!-- Error (exercise load failed after a valid ID was provided) -->
  <div
    v-if="error && !showStudentDashboard"
    class="flex h-screen items-center justify-center bg-background"
  >
    <Card class="w-96">
      <CardHeader>
        <CardTitle class="text-destructive">{{ t(L.student.error) }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <p class="text-sm text-muted-foreground">{{ error }}</p>
        <Button variant="outline" class="w-full" @click="loadExercise()">
          <X class="mr-2 h-4 w-4" />
          {{ t(L.student.tryAgain) }}
        </Button>
      </CardContent>
    </Card>
  </div>

  <!-- Main student view -->
  <div
    v-if="!isLoading && !error && exerciseStore.exerciseId"
    class="flex h-screen flex-col bg-background"
  >
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-border px-6 py-3">
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500"
        >
          <Code class="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 class="font-semibold text-foreground">{{ t(L.auth.appName) }}</h1>
          <p class="text-xs text-muted-foreground">{{ t(L.student.appName) }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <ExamToolbar
          :time-remaining-seconds="isTimerActive ? timeRemainingSeconds : null"
          :is-timer-urgent="isTimerUrgent"
          :show-submit-button="showSubmitButton"
          :is-submitting="isSubmitting"
          :is-locked="exerciseStore.isExerciseLocked"
          :is-finished="exerciseStore.isFinished"
          @submit-clicked="showSubmitConfirmDialog = true"
        />
        <Button variant="secondary" class="h-9 gap-1.5 px-3" @click="openStudentDashboard">
          <LayoutDashboard class="mr-2 h-4 w-4" />
          {{ t(L.student.dashboard) }}
        </Button>
        <LanguageToggle />
        <ThemeToggle />
        <UserMenu @sign-out="handleSignOut" />
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden">
      <ResizablePanelGroup direction="horizontal" class="h-full">
        <ResizablePanel :default-size="60" :min-size="35">
          <CodeEditor :readonly="exerciseStore.isExerciseLocked" />
        </ResizablePanel>
        <ResizableHandle class="w-1 bg-border transition-colors hover:bg-primary/50" />
        <ResizablePanel :default-size="40" :min-size="30">
          <ChatWindow
            :ai-chat-mode="examSettings?.aiChatMode ?? 'enabled'"
            :locked="exerciseStore.isExerciseLocked"
            :exercise-title="exerciseTitle"
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>

    <SubmitConfirmDialog
      :open="showSubmitConfirmDialog"
      :is-submitting="isSubmitting"
      @confirm="async () => { await performSubmit(); showSubmitConfirmDialog = false }"
      @cancel="showSubmitConfirmDialog = false"
    />
    <TimesUpDialog
      :open="showTimesUpDialog"
      @close="showTimesUpDialog = false"
    />
  </div>

  <StudentDashboardDialog
    :open="showStudentDashboard"
    :exercises="dashboardExercises"
    :loading="dashboardLoading"
    :error="dashboardError"
    :current-exercise-id="exerciseStore.exerciseId"
    :switching-exercise-id="switchingExerciseId"
    @close="handleDashboardClose"
    @refresh="loadStudentDashboardData"
    @select-exercise="handleSelectExercise"
  />
</template>

