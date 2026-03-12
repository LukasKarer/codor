<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Code, Plus, ClipboardList, Copy, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ThemeToggle from '@/components/ThemeToggle.vue'

const router = useRouter()
const teacherName = 'Sarah Johnson'
const lastExerciseId = ref<string | null>(null)
const copiedLink = ref(false)

onMounted(() => {
  lastExerciseId.value = localStorage.getItem('lastCreatedExerciseId')
})

const getStudentLink = (exerciseId: string) => {
  return `${window.location.origin}/?exercise_id=${exerciseId}`
}

const handleCopyLink = (exerciseId: string) => {
  navigator.clipboard.writeText(getStudentLink(exerciseId))
  copiedLink.value = true
  setTimeout(() => (copiedLink.value = false), 2000)
}
</script>

<template>
  <div class="flex h-screen flex-col relative overflow-hidden">
    <!-- Header -->
    <header class="border-b border-border px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500"
          >
            <Code class="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-foreground">CodeLearn</h1>
            <p class="text-xs text-muted-foreground">Teacher Dashboard</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto p-8">
      <div class="mx-auto max-w-6xl space-y-8">
        <!-- Welcome Section -->
        <div>
          <h2 class="text-3xl font-bold text-foreground">Welcome back, {{ teacherName }}! 👋</h2>
          <p class="mt-2 text-muted-foreground">
            Manage your coding exercises and track student progress
          </p>
        </div>

        <!-- Action Cards -->
        <div class="grid gap-6 md:grid-cols-2">
          <!-- Create Exercise Card -->
          <Card
            class="group cursor-pointer transition-all hover:shadow-lg hover:scale-105 relative overflow-hidden"
            @click="router.push('/teacher/upload')"
          >
            <div
              class="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-[2px] bg-gradient-to-r from-blue-500 via-purple-600 via-blue-500 to-purple-600 bg-[length:200%_100%] animate-gradient"
            >
              <div class="h-full w-full rounded-lg bg-card" />
            </div>
            <CardHeader class="relative z-10">
              <div class="flex items-center justify-center py-8">
                <div
                  class="flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500"
                >
                  <Plus class="h-12 w-12 text-white" />
                </div>
              </div>
              <CardTitle class="text-center text-xl">Create Exercise</CardTitle>
              <CardDescription class="text-center">
                Design a new coding task with step-by-step guidance for your students
              </CardDescription>
            </CardHeader>
          </Card>

          <!-- Student Progress Card -->
          <Card
            class="group cursor-pointer transition-all hover:shadow-lg hover:scale-105 relative overflow-hidden"
            @click="router.push('/teacher/progress')"
          >
            <div
              class="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-[2px] bg-gradient-to-r from-blue-500 via-purple-600 via-blue-500 to-purple-600 bg-[length:200%_100%] animate-gradient"
            >
              <div class="h-full w-full rounded-lg bg-card" />
            </div>
            <CardHeader class="relative z-10">
              <div class="flex items-center justify-center py-8">
                <div
                  class="flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500"
                >
                  <ClipboardList class="h-12 w-12 text-white" />
                </div>
              </div>
              <CardTitle class="text-center text-xl">Student Progress</CardTitle>
              <CardDescription class="text-center">
                Review student submissions, track progress, and analyze AI tutor interactions
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <!-- Last Created Exercise Link -->
        <Card v-if="lastExerciseId">
          <CardHeader>
            <CardTitle>Share Exercise Link</CardTitle>
            <CardDescription>
              Share this link with your students to access the latest exercise
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="space-y-2">
              <Label for="exercise-link">Student Access Link</Label>
              <div class="flex gap-2">
                <Input
                  id="exercise-link"
                  :model-value="getStudentLink(lastExerciseId)"
                  readonly
                  class="font-mono text-sm"
                />
                <Button variant="outline" size="icon" @click="handleCopyLink(lastExerciseId)">
                  <Check v-if="copiedLink" class="h-4 w-4 text-green-600" />
                  <Copy v-else class="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              Exercise ID: <code class="bg-muted px-1 py-0.5 rounded">{{ lastExerciseId }}</code>
            </p>
          </CardContent>
        </Card>

        <!-- Quick Stats -->
        <div class="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader class="pb-3">
              <CardDescription>Total Exercises</CardDescription>
              <CardTitle class="text-3xl">{{ lastExerciseId ? '1+' : '0' }}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader class="pb-3">
              <CardDescription>Active Students</CardDescription>
              <CardTitle class="text-3xl">-</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader class="pb-3">
              <CardDescription>Avg. Completion Rate</CardDescription>
              <CardTitle class="text-3xl">-</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>
