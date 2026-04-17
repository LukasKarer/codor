<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  isSubmitting: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    >
      <Card class="w-full max-w-md">
        <CardHeader>
          <CardTitle>{{ t(L.exam.submitDialog.title) }}</CardTitle>
          <CardDescription>{{ t(L.exam.submitDialog.description) }}</CardDescription>
        </CardHeader>
        <CardContent class="flex justify-end gap-2">
          <Button
            variant="outline"
            :disabled="props.isSubmitting"
            @click="emit('cancel')"
          >
            {{ t(L.exam.submitDialog.cancel) }}
          </Button>
          <Button
            variant="destructive"
            :disabled="props.isSubmitting"
            @click="emit('confirm')"
          >
            <Loader2 v-if="props.isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
            {{ t(L.exam.submitDialog.confirm) }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </Teleport>
</template>
