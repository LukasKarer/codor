<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from '@/components/ui/sonner'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app'
import { getProfile, invalidateProfileCache } from '@/lib/api'

const store = useAppStore()

async function loadProfile() {
  try {
    const profile = await getProfile()
    store.isTeacher = profile.is_teacher
    store.isAdmin = profile.is_admin
    store.isSystemAdmin = profile.is_system_admin
    store.userName = profile.name
    store.organisationId = profile.organisation_id
  } catch {
    store.isTeacher = false
    store.isAdmin = false
    store.isSystemAdmin = false
  }
}

onMounted(() => {
  // Hydrate store with current session on first load
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      store.user = data.session.user
      store.session = data.session
      loadProfile()
    }
  })

  // Keep store in sync as auth state changes (login, logout, token refresh)
  supabase.auth.onAuthStateChange((_event, session) => {
    store.user = session?.user ?? null
    store.session = session ?? null
    if (session) {
      loadProfile()
    } else {
      invalidateProfileCache()
      store.isTeacher = false
      store.isAdmin = false
      store.isSystemAdmin = false
    }
  })
})
</script>

<template>
  <Toaster />
  <RouterView />
</template>
