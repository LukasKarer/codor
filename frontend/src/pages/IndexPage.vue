<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Code, GraduationCap, Loader2 } from 'lucide-vue-next'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import CodeEditor from '@/components/CodeEditor.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/stores/app'
import {
  getExerciseInfo,
  parseExerciseContent,
  createUser,
  pushUserContent,
  getUserInfo,
} from '@/lib/api'

const store = useAppStore()
const route = useRoute()

const isLoading = ref(true)
const error = ref<string | null>(null)
const needsSetup = ref(false)
const academicIdInput = ref('')
const exerciseTitle = ref('Lesson')

// Auto-save interval
let saveInterval: ReturnType<typeof setInterval> | null = null

const startAutoSave = () => {
  if (saveInterval) clearInterval(saveInterval)
  saveInterval = setInterval(async () => {
    if (!store.userId || !store.code) return
    try {
      await pushUserContent(store.userId, store.code)
      console.log('Code auto-saved')
    } catch (e) {
      console.error('Failed to auto-save code:', e)
    }
  }, 30000)
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

const loadExercise = async () => {
  isLoading.value = true
  error.value = null

  try {
    const urlExerciseId = route.query.exercise_id as string | undefined
    const storedExerciseId = localStorage.getItem('currentExerciseId')
    const storedUserId = localStorage.getItem('currentUserId')
    const storedAcademicId = localStorage.getItem('currentAcademicId')

    const targetExerciseId = urlExerciseId || storedExerciseId

    if (!targetExerciseId) {
      error.value = 'No exercise ID provided. Please use a valid exercise link.'
      isLoading.value = false
      return
    }

    console.log(`[StudentView] Loading exercise: ${targetExerciseId}`)

    const exerciseInfo = await getExerciseInfo(targetExerciseId)
    console.log(`[StudentView] Exercise info loaded:`, exerciseInfo)

    const parsedContent = parseExerciseContent(exerciseInfo.content)
    console.log(`[StudentView] Parsed content:`, parsedContent)

    store.exerciseId = targetExerciseId
    store.exerciseDescription = parsedContent.description
    store.steps = parsedContent.steps.map((step, idx) => ({ ...step, id: idx + 1 }))
    exerciseTitle.value = parsedContent.title

    if (storedUserId && storedAcademicId) {
      try {
        const userInfo = await getUserInfo(storedUserId)
        if (userInfo.exercise_id === targetExerciseId) {
          store.userId = storedUserId
          store.academicId = parseInt(storedAcademicId)
          store.code = parsedContent.code
          isLoading.value = false
          return
        }
      } catch (e) {
        console.error('Stored user not found or invalid', e)
      }
    }

    store.code = parsedContent.code
    needsSetup.value = true
    isLoading.value = false
  } catch (e) {
    console.error('Failed to load exercise:', e)
    error.value = e instanceof Error ? e.message : 'Failed to load exercise'
    isLoading.value = false
  }
}

const handleStartExercise = async () => {
  if (!academicIdInput.value.trim() || !store.exerciseId) return

  const parsedAcademicId = parseInt(academicIdInput.value)
  if (isNaN(parsedAcademicId)) {
    error.value = 'Academic ID must be a number'
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const user = await createUser(store.exerciseId, parsedAcademicId)

    store.userId = user.sub
    store.academicId = parsedAcademicId

    localStorage.setItem('currentExerciseId', store.exerciseId)
    localStorage.setItem('currentUserId', user.sub)
    localStorage.setItem('currentAcademicId', parsedAcademicId.toString())

    needsSetup.value = false
  } catch (e) {
    console.error('Failed to create user:', e)
    error.value = e instanceof Error ? e.message : 'Failed to start exercise'
  } finally {
    isLoading.value = false
  }
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

  <!-- Error -->
  <div v-else-if="error" class="flex h-screen items-center justify-center bg-background">
    <Card class="w-96">
      <CardHeader>
        <CardTitle class="text-destructive">Error</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">{{ error }}</p>
      </CardContent>
    </Card>
  </div>

  <!-- Setup -->
  <div v-else-if="needsSetup" class="flex h-screen items-center justify-center bg-background">
    <Card class="w-96">
      <CardHeader>
        <CardTitle>Start Exercise</CardTitle>
        <CardDescription>Enter your academic ID to begin</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="academic-id">Academic ID (Student Number)</Label>
          <Input
            id="academic-id"
            type="text"
            inputmode="numeric"
            placeholder="e.g., 12345"
            v-model="academicIdInput"
            @keyup.enter="handleStartExercise"
          />
        </div>
        <Button class="w-full" :disabled="!academicIdInput.trim()" @click="handleStartExercise">
          Start Exercise
        </Button>
      </CardContent>
    </Card>
  </div>

  <!-- Main student view -->
  <div v-else class="flex h-screen flex-col bg-background">
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
        <div v-if="store.academicId" class="text-xs text-muted-foreground">
          ID: {{ store.academicId }}
        </div>
        <ThemeToggle />
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
