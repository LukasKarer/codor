<script setup lang="ts">
import { ref } from 'vue'
import { Languages, ChevronDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import { Button } from '@/components/ui/button'

const { t, locale } = useI18n()

type Locale = 'en' | 'de'
const current = ref<Locale>(locale.value as Locale)

const locales: Locale[] = ['en', 'de']

function setLocale(l: Locale) {
  current.value = l
  locale.value = l
  localStorage.setItem('locale', l)
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="h-9 gap-1.5 px-3">
        <Languages class="h-4 w-4 shrink-0" />
        <span>{{ current === 'en' ? 'EN' : 'DE' }}</span>
        <ChevronDown class="h-3.5 w-3.5 shrink-0 opacity-60" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      >
        <DropdownMenuItem
          v-for="l in locales"
          :key="l"
          class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground"
          :class="{ 'bg-accent text-accent-foreground': current === l }"
          @click="setLocale(l)"
        >
          {{ t(`common.language.${l}`) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
