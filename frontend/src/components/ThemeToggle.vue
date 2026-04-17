<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { Moon, Sun, SunMoon, ChevronDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import { Button } from '@/components/ui/button'

const { t } = useI18n()

enum Theme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || Theme.System)

watchEffect(() => {
  const root = window.document.documentElement
  root.classList.remove(Theme.Light, Theme.Dark)
  if (theme.value === Theme.System) {
    root.classList.add(window.matchMedia(DARK_SCHEME_QUERY).matches ? Theme.Dark : Theme.Light)
  } else {
    root.classList.add(theme.value)
  }
  localStorage.setItem('theme', theme.value)
})

const themeIcon = computed(() => {
  if (theme.value === Theme.Light) return Sun
  if (theme.value === Theme.Dark) return Moon
  return SunMoon
})

const options = Object.values(Theme)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="h-9 gap-1.5 px-3">
        <component :is="themeIcon" class="h-4 w-4 shrink-0" />
        <span>{{ t(`common.theme.${theme}`) }}</span>
        <ChevronDown class="h-3.5 w-3.5 shrink-0 opacity-60" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <DropdownMenuItem
          v-for="option in options"
          :key="option"
          class="relative flex cursor-pointer select-none items-center mt-1 gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          :class="{ 'bg-accent text-accent-foreground': theme === option }"
          @click="theme = option"
        >
          <Sun v-if="option === Theme.Light" class="h-4 w-4 shrink-0" />
          <Moon v-else-if="option === Theme.Dark" class="h-4 w-4 shrink-0" />
          <SunMoon v-else class="h-4 w-4 shrink-0" />
          {{ t(`common.theme.${option}`) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
