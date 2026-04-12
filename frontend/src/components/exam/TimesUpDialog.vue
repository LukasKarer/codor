<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EXAM_STRINGS } from './constants'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
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
          <CardTitle class="flex items-center gap-2">
            <AlertTriangle class="h-5 w-5 text-destructive" />
            {{ EXAM_STRINGS.timesUpDialog.title }}
          </CardTitle>
          <CardDescription>{{ EXAM_STRINGS.timesUpDialog.description }}</CardDescription>
        </CardHeader>
        <CardContent class="flex justify-end">
          <Button @click="emit('close')">
            {{ EXAM_STRINGS.timesUpDialog.closeLabel }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </Teleport>
</template>
