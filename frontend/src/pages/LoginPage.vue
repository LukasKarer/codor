<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Code, Mail, Loader2, Eye, EyeOff, User, Building2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { getProfile, getPublicOrganisations, setupProfile, invalidateProfileCache } from '@/lib/api'
import type { PublicOrganisation } from '@/lib/api'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isSignUp = ref(false)
const isLoading = ref(false)
const isMicrosoftLoading = ref(false)

// Sign-up only fields
const signupName = ref('')
const signupOrgId = ref('')
const organisations = ref<PublicOrganisation[]>([])

const redirectTo = (route.query.redirect as string) || '/'

/**
 * "setup" mode: the user is already authenticated (e.g. just confirmed their
 * email) but profile setup was never completed. We skip the password fields
 * and go straight to name + org.
 */
const isSetupMode = ref(route.query.setup === '1')

onMounted(async () => {
  try {
    organisations.value = await getPublicOrganisations()
  } catch {
    // non-fatal — org list just won't be shown
  }

  // In setup mode, pre-fill the email from the current session
  if (isSetupMode.value) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      // No active session — fall back to normal login
      isSetupMode.value = false
      return
    }
    authStore.user = data.session.user
    authStore.session = data.session
    email.value = data.session.user.email ?? ''
    isSignUp.value = true
  }
})

/**
 * Orgs whose email_patterns allow the current email input.
 * If patterns is empty the org is open to everyone.
 */
const eligibleOrgs = computed(() => {
  const e = email.value.trim().toLowerCase()
  return organisations.value.filter((org) => {
    if (org.email_patterns.length === 0) return true
    return org.email_patterns.some((p) => e.includes(p.toLowerCase()))
  })
})

/** Reset org selection when email changes and current org is no longer eligible */
function onEmailInput() {
  if (signupOrgId.value && !eligibleOrgs.value.find((o) => o.id === signupOrgId.value)) {
    signupOrgId.value = ''
  }
}

const signupValid = computed(() => {
  return (
    email.value.trim() &&
    password.value &&
    signupName.value.trim() &&
    signupOrgId.value
  )
})

const setupValid = computed(() => signupName.value.trim() && signupOrgId.value)

/** Called in setup mode — user is already logged in, just needs profile saved */
async function handleSetupProfile() {
  if (!setupValid.value) return
  isLoading.value = true
  try {
    await setupProfile(signupName.value.trim(), signupOrgId.value)
    invalidateProfileCache()
    const profile = await getProfile()
    authStore.applyProfile(profile)
    toast.success('Profile saved')
    router.push(profile.is_teacher ? '/teacher' : redirectTo)
  } catch (e: unknown) {
    toast.error('Setup failed: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    isLoading.value = false
  }
}

const handleEmailAuth = async () => {
  if (!email.value.trim() || !password.value) return
  if (isSignUp.value && !signupValid.value) {
    toast.error('Please fill in all fields and select an organisation')
    return
  }
  isLoading.value = true

  try {
    if (isSignUp.value) {
      // Persist name + org so AuthCallback can complete the profile even when
      // email confirmation is enabled and no session is returned immediately.
      localStorage.setItem('pendingProfileName', signupName.value.trim())
      localStorage.setItem('pendingProfileOrgId', signupOrgId.value || '')

      const { data, error } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
      })
      if (error) throw error

      // If a session is returned immediately (e.g. email confirmation disabled)
      // set up the profile right away on the backend.
      if (data.session) {
        try {
          await setupProfile(signupName.value.trim(), signupOrgId.value || null)
          localStorage.removeItem('pendingProfileName')
          localStorage.removeItem('pendingProfileOrgId')
        } catch (e) {
          // Non-fatal here — show a warning but don't block
          toast.warning('Account created but profile setup failed: ' + (e instanceof Error ? e.message : String(e)))
        }
      }

      toast.success('Account created', {
        description: data.session
          ? 'You are now signed in.'
          : 'Check your email for the confirmation link. Your profile will be saved automatically after confirming.',
      })

      if (data.session) {
        authStore.user = data.user
        authStore.session = data.session
        try {
          invalidateProfileCache()
          const profile = await getProfile()
          authStore.applyProfile(profile)
          router.push(profile.is_teacher ? '/teacher' : redirectTo)
        } catch {
          router.push(redirectTo)
        }
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value,
      })
      if (error) throw error
      authStore.user = data.user
      authStore.session = data.session
      // Determine destination from DB profile (source of truth for role flags)
      try {
        invalidateProfileCache()
        const profile = await getProfile()
        authStore.applyProfile(profile)
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
  <div class="flex h-screen items-center justify-center bg-background px-4 overflow-auto py-8">
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

      <!-- ── SETUP MODE: already authenticated, just need name + org ── -->
      <Card v-if="isSetupMode">
        <CardHeader class="pb-4">
          <CardTitle class="text-center text-lg">Complete your profile</CardTitle>
          <CardDescription class="text-center">
            Tell us your name and organisation to finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Name -->
          <div class="space-y-1.5">
            <Label for="setup-name">Full Name</Label>
            <div class="relative">
              <User class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="setup-name"
                type="text"
                placeholder="Your name"
                class="pl-9"
                v-model="signupName"
                @keyup.enter="handleSetupProfile"
              />
            </div>
          </div>

          <!-- Organisation selector -->
          <div class="space-y-1.5">
            <Label for="setup-org">Organisation</Label>
            <div class="relative">
              <Building2 class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                id="setup-org"
                v-model="signupOrgId"
                class="w-full appearance-none rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
              >
                <option value="" disabled>Select your organisation…</option>
                <option v-for="org in eligibleOrgs" :key="org.id" :value="org.id">
                  {{ org.name }}
                </option>
              </select>
            </div>
            <p v-if="email.trim() && eligibleOrgs.length === 0" class="text-xs text-destructive">
              No organisations match your email address.
            </p>
          </div>

          <Button
            class="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600"
            :disabled="!setupValid || isLoading"
            @click="handleSetupProfile"
          >
            <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
            {{ isLoading ? 'Saving…' : 'Continue' }}
          </Button>
        </CardContent>
      </Card>

      <!-- ── NORMAL SIGN-IN / SIGN-UP ── -->
      <Card v-else>
        <CardHeader class="pb-4">
          <CardTitle class="text-center text-lg">
            {{ isSignUp ? 'Create an account' : 'Welcome back' }}
          </CardTitle>
          <CardDescription class="text-center">
            {{ isSignUp ? 'Sign up to get started' : 'Sign in to continue' }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Microsoft Login (sign-in only) -->
          <Button
            v-if="!isSignUp"
            variant="outline"
            class="w-full gap-2"
            :disabled="isMicrosoftLoading || isLoading"
            @click="handleMicrosoftLogin"
          >
            <Loader2 v-if="isMicrosoftLoading" class="h-4 w-4 animate-spin" />
            <svg v-else viewBox="0 0 21 21" class="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            {{ isMicrosoftLoading ? 'Redirecting...' : 'Continue with Microsoft' }}
          </Button>

          <div v-if="!isSignUp" class="flex items-center gap-3">
            <Separator class="flex-1" />
            <span class="text-xs text-muted-foreground">or</span>
            <Separator class="flex-1" />
          </div>

          <!-- Email / Password -->
          <div class="space-y-3">
            <!-- Name (sign-up only) -->
            <div v-if="isSignUp" class="space-y-1.5">
              <Label for="display-name">Full Name</Label>
              <div class="relative">
                <User class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="display-name"
                  type="text"
                  placeholder="Your name"
                  class="pl-9"
                  v-model="signupName"
                  @keyup.enter="handleEmailAuth"
                />
              </div>
            </div>

            <!-- Email -->
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
                  @input="onEmailInput"
                  @keyup.enter="handleEmailAuth"
                />
              </div>
            </div>

            <!-- Password -->
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

            <!-- Organisation selector (sign-up only) -->
            <div v-if="isSignUp" class="space-y-1.5">
              <Label for="organisation">Organisation</Label>
              <div class="relative">
                <Building2 class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  id="organisation"
                  v-model="signupOrgId"
                  class="w-full appearance-none rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                >
                  <option value="" disabled>Select your organisation…</option>
                  <option
                    v-for="org in eligibleOrgs"
                    :key="org.id"
                    :value="org.id"
                  >
                    {{ org.name }}
                  </option>
                </select>
              </div>
              <p
                v-if="isSignUp && email.trim() && eligibleOrgs.length === 0"
                class="text-xs text-destructive"
              >
                No organisations match your email address.
              </p>
              <p v-else class="text-xs text-muted-foreground">
                Only organisations that accept your email are shown.
              </p>
            </div>

            <Button
              class="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600"
              :disabled="
                isSignUp
                  ? (!signupValid || isLoading || isMicrosoftLoading)
                  : (!email.trim() || !password || isLoading || isMicrosoftLoading)
              "
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
