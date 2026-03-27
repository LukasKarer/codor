import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User, Session } from '@supabase/supabase-js'
import { invalidateProfileCache } from '@/lib/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)

  const isTeacher = ref(false)
  const isAdmin = ref(false)
  const isSystemAdmin = ref(false)

  const userName = ref('')
  const organisationId = ref<string | null>(null)

  function applyProfile(profile: {
    is_teacher: boolean
    is_admin: boolean
    is_system_admin: boolean
    name: string
    organisation_id: string | null
  }) {
    isTeacher.value = profile.is_teacher
    isAdmin.value = profile.is_admin
    isSystemAdmin.value = profile.is_system_admin
    userName.value = profile.name
    organisationId.value = profile.organisation_id
  }

  function clearRoles() {
    isTeacher.value = false
    isAdmin.value = false
    isSystemAdmin.value = false
    userName.value = ''
    organisationId.value = null
  }

  function logout() {
    invalidateProfileCache()
    user.value = null
    session.value = null
    clearRoles()
  }

  return {
    user,
    session,
    isTeacher,
    isAdmin,
    isSystemAdmin,
    userName,
    organisationId,
    applyProfile,
    clearRoles,
    logout,
  }
})
