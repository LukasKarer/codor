<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

const { locale } = useI18n()

function toggleLanguage() {
  const next = locale.value === 'de' ? 'en' : 'de'
  locale.value = next
  localStorage.setItem('locale', next)
}
</script>

<template>
  <Button variant="outline" size="icon" class="h-9 w-9 text-xs font-semibold" @click="toggleLanguage">
    {{ locale === 'de' ? 'DE' : 'EN' }}
  </Button>
</template>
