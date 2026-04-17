<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'

const route = useRoute()
const { t } = useI18n()

onMounted(() => {
  console.error('404 Error: User attempted to access non-existent route:', route.path)
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted">
    <div class="text-center">
      <h1 class="mb-4 text-4xl font-bold">{{ t(L.common.notFound.code) }}</h1>
      <p class="mb-4 text-xl text-muted-foreground">{{ t(L.common.notFound.title) }}</p>
      <a href="/" class="text-primary underline hover:text-primary/90">{{ t(L.common.notFound.home) }}</a>
    </div>
  </div>
</template>
