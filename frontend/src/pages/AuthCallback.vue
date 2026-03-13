<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app'
import { getProfile } from '@/lib/api'

const router = useRouter()
const store = useAppStore()

onMounted(async () => {
  // Supabase handles the code exchange automatically on getSession after OAuth redirect
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    store.user = data.session.user
    store.session = data.session
    // Determine destination from DB profile (source of truth for role flags)
    try {
      const profile = await getProfile()
      store.isTeacher = profile.is_teacher
      store.isAdmin = profile.is_admin
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
