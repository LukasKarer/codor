import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'index',
      component: () => import('@/pages/IndexPage.vue'),
    },
    {
      path: '/teacher',
      name: 'teacher-dashboard',
      component: () => import('@/pages/TeacherDashboard.vue'),
    },
    {
      path: '/teacher/upload',
      name: 'teacher-upload',
      component: () => import('@/pages/TeacherUpload.vue'),
    },
    {
      path: '/teacher/progress',
      name: 'student-progress',
      component: () => import('@/pages/StudentProgress.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFound.vue'),
    },
  ],
})

export default router
