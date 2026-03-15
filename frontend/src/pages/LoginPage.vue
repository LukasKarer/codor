<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Code, Mail, Loader2, Eye, EyeOff } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app'
import { getProfile } from '@/lib/api'

const router = useRouter()
const route = useRoute()
const store = useAppStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isSignUp = ref(false)
const isLoading = ref(false)
const isMicrosoftLoading = ref(false)

const redirectTo = (route.query.redirect as string) || '/'

const handleEmailAuth = async () => {
  if (!email.value.trim() || !password.value) return
  isLoading.value = true

  try {
    if (isSignUp.value) {
      const { error } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
      })
      if (error) throw error
      toast.success('Account created', {
        description: 'Check your email for the confirmation link.',
      })
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value,
      })
      if (error) throw error
      store.user = data.user
      store.session = data.session
      // Determine destination from DB profile (source of truth for role flags)
      try {
        const profile = await getProfile()
        store.isTeacher = profile.is_teacher
        store.isAdmin = profile.is_admin
        store.organisationId = profile.organisation_id
        router.push(profile.is_teacher ? '/teacher' : redirectTo)
      } catch {
        router.push(redirectTo)
      }
    }
  } catch (e: unknown) {
    toast.error('Authentication failed', {
      description: e instanceof Error ? e.message : 'Please try again.',
    })
  } finally {
    isLoading.value = false
  }
}
const handleMicrosoftLogin = async () => {
  isMicrosoftLoading.value = true
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    // Page will redirect — loading state stays until navigation
  } catch (e: unknown) {
    isMicrosoftLoading.value = false
    toast.error('Microsoft login failed', {
      description: e instanceof Error ? e.message : 'Please try again.',
    })
  }
}
</script>

<template>
  <div class="flex h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm space-y-6">
      <!-- Logo -->
      <div class="flex flex-col items-center gap-3">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-500"
        >
          <Code class="h-6 w-6 text-white" />
        </div>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-foreground">CodeMentor</h1>
          <p class="text-sm text-muted-foreground">Interactive Programming Tutor</p>
        </div>
      </div>

      <Card>
        <CardHeader class="pb-4">
          <CardTitle class="text-center text-lg">
            {{ isSignUp ? 'Create an account' : 'Welcome back' }}
          </CardTitle>
          <CardDescription class="text-center">
            {{ isSignUp ? 'Sign up to get started' : 'Sign in to continue' }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Microsoft Login -->
          <Button
            variant="outline"
            class="w-full gap-2"
            :disabled="isMicrosoftLoading || isLoading"
            @click="handleMicrosoftLogin"
          >
            <Loader2 v-if="isMicrosoftLoading" class="h-4 w-4 animate-spin" />
            <!-- Microsoft logo SVG -->
            <svg v-else viewBox="0 0 21 21" class="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            {{ isMicrosoftLoading ? 'Redirecting...' : 'Continue with Microsoft' }}
          </Button>

          <div class="flex items-center gap-3">
            <Separator class="flex-1" />
            <span class="text-xs text-muted-foreground">or</span>
            <Separator class="flex-1" />
          </div>

          <!-- Email / Password -->
          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label for="email">Email</Label>
              <div class="relative">
                <Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  class="pl-9"
                  v-model="email"
                  @keyup.enter="handleEmailAuth"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <Label for="password">Password</Label>
              <div class="relative">
                <Input
                  id="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="••••••••"
                  class="pr-9"
                  v-model="password"
                  @keyup.enter="handleEmailAuth"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" class="h-4 w-4" />
                  <Eye v-else class="h-4 w-4" />
                </button>
              </div>
            </div>

            <Button
              class="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600"
              :disabled="!email.trim() || !password || isLoading || isMicrosoftLoading"
              @click="handleEmailAuth"
            >
              <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
              {{ isLoading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In' }}
            </Button>
          </div>

          <!-- Toggle sign-up / sign-in -->
          <p class="text-center text-sm text-muted-foreground">
            {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
            <button
              type="button"
              class="font-medium text-primary hover:underline"
              @click="isSignUp = !isSignUp"
            >
              {{ isSignUp ? 'Sign in' : 'Sign up' }}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
