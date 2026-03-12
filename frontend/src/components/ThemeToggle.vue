<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { Moon, Sun } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const theme = ref<'light' | 'dark'>((localStorage.getItem('theme') as 'light' | 'dark') || 'light')

watchEffect(() => {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme.value)
  localStorage.setItem('theme', theme.value)
})

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}
</script>

<template>
  <Button variant="outline" size="icon" class="relative h-9 w-9" @click="toggleTheme">
    <Sun
      class="h-4 w-4 transition-all"
      :class="theme === 'dark' ? '-rotate-90 scale-0' : 'rotate-0 scale-100'"
    />
    <Moon
      class="absolute h-4 w-4 transition-all"
      :class="theme === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0'"
    />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
