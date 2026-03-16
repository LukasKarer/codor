import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/lib/api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/pages/AuthCallback.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'index',
      component: () => import('@/pages/IndexPage.vue'),
    },
    {
      path: '/teacher',
      name: 'teacher-dashboard',
      component: () => import('@/pages/TeacherDashboard.vue'),
      meta: { requiresTeacher: true },
    },
    {
      path: '/teacher/upload',
      name: 'teacher-upload',
      component: () => import('@/pages/TeacherUpload.vue'),
      meta: { requiresTeacher: true },
    },
    {
      path: '/teacher/progress',
      name: 'student-progress',
      component: () => import('@/pages/StudentProgress.vue'),
      meta: { requiresTeacher: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/pages/AdminPage.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFound.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  // Public routes never require auth
  if (to.meta.public) return true

  const { data } = await supabase.auth.getSession()
  const session = data.session

  if (!session) {
    // Not logged in — send to login, preserving the intended destination
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresTeacher) {
    // Fetch role from DB (source of truth) and hydrate store so pages see
    // correct flags even after a hard refresh (Pinia state is not persisted)
    let isTeacher = false
    try {
      const { useAppStore } = await import('@/stores/app')
      const store = useAppStore()
      const profile = await getProfile()
      store.isTeacher = profile.is_teacher
      store.isAdmin = profile.is_admin
      store.isSystemAdmin = profile.is_system_admin
      store.userName = profile.name
      store.organisationId = profile.organisation_id
      isTeacher = profile.is_teacher
    } catch {
      isTeacher = false
    }
    if (!isTeacher) return { name: 'index' }
  }

  if (to.meta.requiresAdmin) {
    // Fetch role from DB (source of truth) and hydrate store so AdminPage sees
    // correct flags even after a hard refresh (Pinia state is not persisted)
    let canAccess = false
    try {
      const { useAppStore } = await import('@/stores/app')
      const store = useAppStore()
      const profile = await getProfile()
      store.isTeacher = profile.is_teacher
      store.isAdmin = profile.is_admin
      store.isSystemAdmin = profile.is_system_admin
      store.userName = profile.name
      store.organisationId = profile.organisation_id
      // Both system admins and org-level admins can access the admin panel
      canAccess = profile.is_system_admin || profile.is_admin
    } catch {
      canAccess = false
    }
    if (!canAccess) return { name: 'index' }
  }

  return true
})

export default router
