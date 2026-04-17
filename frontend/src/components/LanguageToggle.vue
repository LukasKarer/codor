<script setup lang="ts">
import { Globe, ChevronDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import { Button } from '@/components/ui/button'

const { locale, t, availableLocales } = useI18n()

function select(value: string) {
  locale.value = value
  localStorage.setItem('locale', value)
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="h-9 gap-1.5 px-3">
        <Globe class="h-4 w-4 shrink-0" />
        <span>{{ t(`common.language.${locale}`) }}</span>
        <ChevronDown class="h-3.5 w-3.5 shrink-0 opacity-60" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <DropdownMenuItem
          v-for="option in availableLocales"
          :key="option"
          class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          :class="{ 'bg-accent text-accent-foreground': locale === option }"
          @click="select(option)"
        >
          {{ t(`common.language.${option}`) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
