<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from '@/components/ui/sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { getProfile, invalidateProfileCache } from '@/lib/api'

const authStore = useAuthStore()

async function loadProfile() {
  try {
    const profile = await getProfile()
    authStore.applyProfile(profile)
  } catch {
    authStore.clearRoles()
  }
}

onMounted(() => {
  // Hydrate store with current session on first load
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      authStore.user = data.session.user
      authStore.session = data.session
      loadProfile()
    }
  })

  // Keep store in sync as auth state changes (login, logout, token refresh)
  supabase.auth.onAuthStateChange((_event, session) => {
    authStore.user = session?.user ?? null
    authStore.session = session ?? null
    if (session) {
      loadProfile()
    } else {
      invalidateProfileCache()
      authStore.clearRoles()
    }
  })
})
</script>

<template>
  <Toaster />
  <RouterView />
</template>
