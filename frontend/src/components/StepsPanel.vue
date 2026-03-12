<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle2 } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/stores/app'
import { explainStep, handleHighlightCode } from '@/lib/ai'

const store = useAppStore()
const hoveredStep = ref<number | null>(null)

const getStepColor = (stepId: number) => {
  const colors = [
    {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500',
      text: 'text-purple-500',
      line: 'bg-purple-500',
    },
    { bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-500', line: 'bg-blue-500' },
    { bg: 'bg-cyan-500/10', border: 'border-cyan-500', text: 'text-cyan-500', line: 'bg-cyan-500' },
    {
      bg: 'bg-green-500/10',
      border: 'border-green-500',
      text: 'text-green-500',
      line: 'bg-green-500',
    },
    {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500',
      text: 'text-yellow-500',
      line: 'bg-yellow-500',
    },
    {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500',
      text: 'text-orange-500',
      line: 'bg-orange-500',
    },
    { bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-500', line: 'bg-red-500' },
  ]
  return colors[(stepId - 1) % colors.length]!
}

const onMouseEnter = (stepIndex: number) => {
  const step = store.steps[stepIndex]
  if (!step) return
  hoveredStep.value = stepIndex + 1
  store.codeHighlight = { startLine: step.lineStart, endLine: step.lineEnd }
}

const onMouseLeave = () => {
  hoveredStep.value = null
  store.codeHighlight = null
}

const onStepClick = async (stepIndex: number) => {
  if (store.isStreaming) return

  const step = store.steps[stepIndex]
  if (!step) return
  store.isStreaming = true

  const messageId = Date.now()
  store.messages.push({
    id: messageId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
  })

  let accumulated = ''

  await explainStep(
    step,
    store.code,
    store.exerciseDescription,
    (chunk) => {
      accumulated += chunk
      const msg = store.messages.find((m) => m.id === messageId)
      if (msg) msg.content = accumulated
    },
    (functionCall) => {
      if (functionCall.name === 'highlight_code') {
        const highlight = handleHighlightCode(functionCall.args)
        store.codeHighlight = highlight
        setTimeout(() => (store.codeHighlight = null), 5000)
      }
    },
    () => {
      store.isStreaming = false
    },
    (error) => {
      console.error('explainStep error:', error)
      const msg = store.messages.find((m) => m.id === messageId)
      if (msg) msg.content = 'Sorry, I encountered an error. Please try again.'
      store.isStreaming = false
    },
  )
}
</script>

<template>
  <div class="h-full overflow-auto p-4">
    <Card class="h-full border-0 shadow-none">
      <CardHeader class="px-0 pt-0">
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="flex items-center gap-2">
              <CheckCircle2 class="h-5 w-5 text-primary" />
              Learning Steps
            </CardTitle>
            <CardDescription> Click a step to get an AI explanation </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent class="space-y-3 px-0">
        <div v-for="(step, index) in store.steps" :key="index">
          <div
            :class="[
              'rounded-lg border-2 p-4 transition-all cursor-pointer backdrop-blur-md bg-white/40 dark:bg-slate-900/40',
              hoveredStep === index + 1
                ? `${getStepColor(index + 1).border} ${getStepColor(index + 1).bg}`
                : 'border-border hover:border-muted-foreground/50',
              store.isStreaming ? 'opacity-60 cursor-not-allowed' : '',
            ]"
            @mouseenter="onMouseEnter(index)"
            @mouseleave="onMouseLeave"
            @click="onStepClick(index)"
          >
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  :class="[
                    'h-6 w-6 rounded-full flex items-center justify-center',
                    getStepColor(index + 1).line,
                  ]"
                >
                  <span class="text-xs font-bold text-white">{{ index + 1 }}</span>
                </div>
                <span class="text-xs text-muted-foreground">
                  Lines {{ step.lineStart }}-{{ step.lineEnd }}
                </span>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <p class="text-sm text-foreground leading-relaxed">
                  {{ step.description }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
