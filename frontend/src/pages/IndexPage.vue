<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BookOpen, Code, GraduationCap, Loader2, LogOut, X } from 'lucide-vue-next'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import CodeEditor from '@/components/CodeEditor.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/stores/app'
import {
  getExerciseInfo,
  parseExerciseContent,
  enrollUser,
  pushExerciseContent,
  getConfig,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const error = ref<string | null>(null)
const exerciseTitle = ref('Lesson')

// Exercise ID prompt dialog
const showExercisePrompt = ref(false)
const promptExerciseId = ref('')
const promptError = ref<string | null>(null)

// Auto-save interval
let saveInterval: ReturnType<typeof setInterval> | null = null

const startAutoSave = () => {
  if (saveInterval) clearInterval(saveInterval)
  saveInterval = setInterval(async () => {
    if (!store.exerciseId || !store.code) return
    try {
      await pushExerciseContent(store.exerciseId, store.code)
      console.log('[AutoSave] Code pushed')
    } catch (e) {
      console.error('[AutoSave] Push failed:', e)
    }
  }, store.pushIntervalMs)
}

watch(
  () => store.userId,
  (val) => {
    if (val) startAutoSave()
    else if (saveInterval) clearInterval(saveInterval)
  },
)

onUnmounted(() => {
  if (saveInterval) clearInterval(saveInterval)
})

const loadExercise = async (overrideId?: string) => {
  isLoading.value = true
  error.value = null
  showExercisePrompt.value = false

  try {
    // Fetch push interval from backend config
    try {
      const config = await getConfig()
      store.pushIntervalMs = config.pushIntervalMs
    } catch {
      // keep default
    }

    const urlExerciseId = route.query.exercise_id as string | undefined
    const storedExerciseId = localStorage.getItem('currentExerciseId')
    const isTestMode = route.query.test === '1'

    const targetExerciseId = overrideId || urlExerciseId || storedExerciseId

    if (!targetExerciseId) {
      // No exercise ID anywhere — show the prompt dialog instead of an error
      showExercisePrompt.value = true
      isLoading.value = false
      return
    }

    // Load exercise content
    let exerciseInfo
    try {
      exerciseInfo = await getExerciseInfo(targetExerciseId)
    } catch (e) {
      // Exercise not found or unreachable — drop back to the prompt so the
      // student can enter a correct ID. Clear stale localStorage so it doesn't
      // auto-trigger on the next page load.
      localStorage.removeItem('currentExerciseId')
      const msg =
        e instanceof Error && e.message.toLowerCase().includes('404')
          ? 'Exercise not found. Please check the ID and try again.'
          : e instanceof Error
            ? e.message
            : 'Failed to load exercise'
      promptError.value = msg
      promptExerciseId.value = ''
      showExercisePrompt.value = true
      isLoading.value = false
      return
    }

    const parsedContent = parseExerciseContent(exerciseInfo.content)

    store.exerciseId = targetExerciseId
    store.exerciseDescription = parsedContent.description
    store.steps = parsedContent.steps.map((step, idx) => ({ ...step, id: idx + 1 }))
    exerciseTitle.value = parsedContent.title
    // Set the exercise's default code first; overwritten below if the student has saved work
    store.code = parsedContent.code

    // Enroll the authenticated user (idempotent for non-test sessions).
    // The response includes saved_content — the student's last pushed code — so
    // we can restore the editor exactly where they left off.
    const enrollment = await enrollUser(targetExerciseId, isTestMode)
    store.userId = enrollment.sub
    if (enrollment.saved_content) {
      store.code = enrollment.saved_content
    }

    localStorage.setItem('currentExerciseId', targetExerciseId)

    isLoading.value = false
  } catch (e) {
    console.error('Failed to load exercise:', e)
    error.value = e instanceof Error ? e.message : 'Failed to load exercise'
    isLoading.value = false
  }
}

const handlePromptSubmit = async () => {
  const id = promptExerciseId.value.trim()
  if (!id) {
    promptError.value = 'Please enter an exercise ID.'
    return
  }
  promptError.value = null
  await loadExercise(id)
}

const handleSignOut = async () => {
  await supabase.auth.signOut()
  store.user = null
  store.session = null
  store.userId = null
  localStorage.removeItem('currentExerciseId')
  router.push('/login')
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

  <!-- Exercise ID prompt dialog (no exercise found in URL or localStorage) -->
  <Transition name="fade">
    <div
      v-if="showExercisePrompt"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <Card class="w-full max-w-md mx-4">
        <CardHeader>
          <div class="flex items-center gap-2">
            <BookOpen class="h-5 w-5 text-primary" />
            <CardTitle class="leading-5">Enter Exercise ID</CardTitle>
          </div>
          <CardDescription>
            Paste the exercise ID given to you by your teacher to join the session.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-1.5">
            <Label for="prompt-exercise-id">Exercise ID</Label>
            <Input
              id="prompt-exercise-id"
              placeholder="e.g. abc123def456"
              v-model="promptExerciseId"
              @keyup.enter="handlePromptSubmit"
              autofocus
            />
            <p v-if="promptError" class="text-sm text-destructive">{{ promptError }}</p>
          </div>
          <Button class="w-full" :disabled="!promptExerciseId.trim()" @click="handlePromptSubmit">
            <GraduationCap class="mr-2 h-4 w-4" />
            Join Exercise
          </Button>
        </CardContent>
      </Card>
    </div>
  </Transition>

  <!-- Error (exercise load failed after a valid ID was provided) -->
  <div
    v-if="error && !showExercisePrompt"
    class="flex h-screen items-center justify-center bg-background"
  >
    <Card class="w-96">
      <CardHeader>
        <CardTitle class="text-destructive">Error</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <p class="text-sm text-muted-foreground">{{ error }}</p>
        <Button variant="outline" class="w-full" @click="loadExercise()">
          <X class="mr-2 h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  </div>

  <!-- Main student view -->
  <div
    v-if="!isLoading && !error && !showExercisePrompt"
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
          <h1 class="font-semibold text-foreground">CodeMentor</h1>
          <p class="text-xs text-muted-foreground">Interactive Programming Tutor</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-2 rounded-full bg-background px-4 py-2 border border-border"
        >
          <GraduationCap class="h-4 w-4 text-primary" />
          <span class="text-sm font-medium text-foreground">{{ exerciseTitle }}</span>
        </div>
        <div v-if="store.user?.email" class="text-xs text-muted-foreground hidden sm:block">
          {{ store.user.email }}
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" class="h-8 w-8" title="Sign out" @click="handleSignOut">
          <LogOut class="h-4 w-4" />
        </Button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden">
      <ResizablePanelGroup direction="horizontal" class="h-full">
        <ResizablePanel :default-size="60" :min-size="35">
          <CodeEditor />
        </ResizablePanel>
        <ResizableHandle class="w-1 bg-border transition-colors hover:bg-primary/50" />
        <ResizablePanel :default-size="40" :min-size="30">
          <ChatWindow />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
