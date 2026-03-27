<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { getProfile, setupProfile, invalidateProfileCache } from '@/lib/api'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  // Supabase handles the code exchange automatically on getSession after OAuth redirect
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    authStore.user = data.session.user
    authStore.session = data.session

    // If name + org were stored at signup time (email/password with confirmation
    // enabled), complete the profile on the backend now that we have a session.
    const pendingName = localStorage.getItem('pendingProfileName')
    const pendingOrgId = localStorage.getItem('pendingProfileOrgId')
    if (pendingName) {
      try {
        await setupProfile(pendingName, pendingOrgId || null)
      } catch {
        // Non-fatal — profile can be completed via setup mode if needed
      }
      localStorage.removeItem('pendingProfileName')
      localStorage.removeItem('pendingProfileOrgId')
    }

    // Determine destination from DB profile (source of truth for role flags)
    try {
      invalidateProfileCache()
      const profile = await getProfile()
      authStore.applyProfile(profile)

      // Profile setup was never completed (e.g. OAuth user with no pending data).
      // Send them back to the login page in "setup" mode so they can finish.
      if (!profile.name && !profile.organisation_id) {
        router.replace('/login?setup=1')
        return
      }

      router.replace(profile.is_teacher ? '/teacher' : '/')
    } catch {
      router.replace('/')
    }
  } else {
    router.replace('/login')
  }
})
</script>

<template>
  <div class="flex h-screen items-center justify-center bg-background">
    <Loader2 class="h-8 w-8 animate-spin text-primary" />
  </div>
</template>
