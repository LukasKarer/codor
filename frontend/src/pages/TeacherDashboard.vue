<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Code, Plus, ClipboardList, Copy, Check, GraduationCap, FlaskConical, LogOut, X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LanguageToggle from '@/components/LanguageToggle.vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const lastExerciseId = ref<string | null>(null)
const copiedLink = ref(false)

// "Try as student" overlay state
const showStudentMode = ref(false)
const testExerciseId = ref('')

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

const handleSignOut = async () => {
  await supabase.auth.signOut()
  authStore.logout()
  router.push('/login')
}

const handleTryAsStudent = () => {
  if (!testExerciseId.value.trim()) {
    toast.error(t(L.teacher.dashboard.exerciseIdLabel))
    return
  }
  // Navigate as a test student — the ?test=1 flag tells IndexPage to enroll with is_test=true
  router.push(`/?exercise_id=${testExerciseId.value.trim()}&test=1`)
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
            <h1 class="text-xl font-bold text-foreground">{{ t(L.teacher.dashboard.appName) }}</h1>
            <p class="text-xs text-muted-foreground">{{ t(L.teacher.dashboard.title) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="authStore.user?.email" class="text-xs text-muted-foreground hidden sm:block">
            {{ authStore.user.email }}
          </span>
          <LanguageToggle />
          <ThemeToggle />
          <Button variant="ghost" size="icon" class="h-8 w-8" :title="t(L.common.signOut)" @click="handleSignOut">
            <LogOut class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto p-8">
      <div class="mx-auto max-w-6xl space-y-8">
        <!-- Welcome Section -->
        <div>
          <h2 class="text-3xl font-bold text-foreground">
            {{ t(L.teacher.dashboard.welcome) }}{{ authStore.user?.email ? ', ' + authStore.user.email.split('@')[0] : '' }}!
          </h2>
          <p class="mt-2 text-muted-foreground">
            {{ t(L.teacher.dashboard.subtitle) }}
          </p>
        </div>

        <!-- Role Selection Cards -->
        <div class="grid gap-6 md:grid-cols-3">
          <!-- Create Exercise -->
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
              <div class="flex items-center justify-center py-6">
                <div
                  class="flex h-20 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500"
                >
                  <Plus class="h-10 w-10 text-white" />
                </div>
              </div>
              <CardTitle class="text-center text-lg">{{ t(L.teacher.dashboard.createExercise) }}</CardTitle>
              <CardDescription class="text-center">
                {{ t(L.teacher.dashboard.createExerciseDescription) }}
              </CardDescription>
            </CardHeader>
          </Card>

          <!-- Student Progress -->
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
              <div class="flex items-center justify-center py-6">
                <div
                  class="flex h-20 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500"
                >
                  <ClipboardList class="h-10 w-10 text-white" />
                </div>
              </div>
              <CardTitle class="text-center text-lg">{{ t(L.teacher.dashboard.studentProgress) }}</CardTitle>
              <CardDescription class="text-center">
                {{ t(L.teacher.dashboard.studentProgressDescription) }}
              </CardDescription>
            </CardHeader>
          </Card>

          <!-- Try as Student -->
          <Card
            class="group cursor-pointer transition-all hover:shadow-lg hover:scale-105 relative overflow-hidden border-dashed"
            @click="showStudentMode = true"
          >
            <div
              class="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-[2px] bg-gradient-to-r from-orange-400 via-yellow-400 via-orange-400 to-yellow-400 bg-[length:200%_100%] animate-gradient"
            >
              <div class="h-full w-full rounded-lg bg-card" />
            </div>
            <CardHeader class="relative z-10">
              <div class="flex items-center justify-center py-6">
                <div
                  class="flex h-20 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500"
                >
                  <GraduationCap class="h-10 w-10 text-white" />
                </div>
              </div>
              <CardTitle class="text-center text-lg">{{ t(L.teacher.dashboard.tryAsStudent) }}</CardTitle>
              <CardDescription class="text-center">
                {{ t(L.teacher.dashboard.tryAsStudentDescription) }}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <!-- Last Created Exercise Link -->
        <Card v-if="lastExerciseId">
          <CardHeader>
            <CardTitle>{{ t(L.teacher.dashboard.shareExerciseLink) }}</CardTitle>
            <CardDescription>
              {{ t(L.teacher.dashboard.shareLinkDescription) }}
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="space-y-2">
              <Label for="exercise-link">{{ t(L.teacher.dashboard.studentAccessLink) }}</Label>
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
              {{ t(L.teacher.dashboard.exerciseId) }} <code class="bg-muted px-1 py-0.5 rounded">{{ lastExerciseId }}</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>

    <!-- "Try as Student" overlay modal -->
    <Transition name="fade">
      <div
        v-if="showStudentMode"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="showStudentMode = false"
      >
        <Card class="w-full max-w-md mx-4">
          <CardHeader>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <FlaskConical class="h-5 w-5 text-orange-500" />
                <CardTitle>{{ t(L.teacher.dashboard.tryAsStudent) }}</CardTitle>
              </div>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="showStudentMode = false">
                <X class="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              {{ t(L.teacher.dashboard.tryAsStudentDialogDescription) }}
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-1.5">
              <Label for="test-exercise-id">{{ t(L.teacher.dashboard.exerciseIdLabel) }}</Label>
              <Input
                id="test-exercise-id"
                :placeholder="t(L.teacher.dashboard.exerciseIdPlaceholder)"
                v-model="testExerciseId"
                @keyup.enter="handleTryAsStudent"
              />
            </div>
            <Button
              class="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600"
              :disabled="!testExerciseId.trim()"
              @click="handleTryAsStudent"
            >
              <GraduationCap class="mr-2 h-4 w-4" />
              {{ t(L.teacher.dashboard.startTestSession) }}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Transition>
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
