<script setup lang="ts">
import { User, LogOut } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { L } from '@/locales/keys'

const emit = defineEmits<{ 'sign-out': [] }>()

const { t } = useI18n()
const authStore = useAuthStore()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon" class="rounded-full">
        <User class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="z-50 min-w-[14rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <div class="px-2 py-2">
          <p v-if="authStore.userName" class="text-sm font-medium leading-tight">{{ authStore.userName }}</p>
          <p v-if="authStore.user?.email" class="text-xs text-muted-foreground leading-tight" :class="{ 'mt-0.5': authStore.userName }">{{ authStore.user.email }}</p>
        </div>
        <DropdownMenuSeparator class="my-1 -mx-1 h-px bg-border" />
        <!-- Sign out item that is marked as destructive/red/error -->
        <DropdownMenuItem
          class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors text-destructive focus:bg-destructive focus:text-white data-[disabled]:pointer-events-none"
          @click="emit('sign-out')"
        >
          <LogOut class="h-4 w-4 shrink-0" />
          {{ t(L.common.signOut) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
