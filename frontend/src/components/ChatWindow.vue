<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { Send, Bot, User, HelpCircle, BookOpen, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/stores/app'
import { streamChat, handleHighlightCode, getLLMHelp } from '@/lib/ai'

const store = useAppStore()
const input = ref('')
const isExerciseExpanded = ref(false)
const shouldShowToggle = ref(false)
const scrollAreaRef = ref<HTMLElement | null>(null)
const exerciseRef = ref<HTMLParagraphElement | null>(null)

// Scroll to bottom when messages change
watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    if (scrollAreaRef.value) {
      const viewport = scrollAreaRef.value.querySelector('[data-radix-scroll-area-viewport]')
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  },
)

// Check if exercise description overflows 6 lines
watch(
  () => store.exerciseDescription,
  async () => {
    await nextTick()
    if (exerciseRef.value) {
      const lineHeight = parseFloat(getComputedStyle(exerciseRef.value).lineHeight)
      const height = exerciseRef.value.scrollHeight
      shouldShowToggle.value = height / lineHeight > 6
    }
  },
  { immediate: true },
)

async function handleGetHelp() {
  if (store.isStreaming) return

  store.isStreaming = true
  const helpMessageId = Date.now()
  store.messages.push({
    id: helpMessageId,
    role: 'assistant',
    content: 'Let me take a look at your code and help you out...',
    timestamp: new Date(),
  })

  let accumulatedContent = ''

  try {
    await getLLMHelp(
      store.code,
      store.exerciseDescription,
      store.steps,
      (chunk) => {
        accumulatedContent += chunk
        const msg = store.messages.find((m) => m.id === helpMessageId)
        if (msg) msg.content = accumulatedContent
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
        console.error('Get help error:', error)
        const msg = store.messages.find((m) => m.id === helpMessageId)
        if (msg)
          msg.content = 'Sorry, I encountered an error while analyzing your code. Please try again.'
        store.isStreaming = false
      },
    )
  } catch (error) {
    console.error('Error getting help:', error)
    store.isStreaming = false
  }
}

async function handleSend() {
  if (!input.value.trim() || store.isStreaming) return

  const userMessage = {
    id: Date.now(),
    role: 'user' as const,
    content: input.value.trim(),
    timestamp: new Date(),
  }

  store.messages.push(userMessage)
  input.value = ''
  store.isStreaming = true

  const assistantMessageId = Date.now() + 1
  store.messages.push({
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
  })

  let accumulatedContent = ''

  try {
    await streamChat([...store.messages.slice(0, -1)], store.code, {
      onTextChunk: (chunk) => {
        accumulatedContent += chunk
        const msg = store.messages.find((m) => m.id === assistantMessageId)
        if (msg) msg.content = accumulatedContent
      },
      onFunctionCall: (functionCall) => {
        if (functionCall.name === 'highlight_code') {
          const highlight = handleHighlightCode(functionCall.args)
          store.codeHighlight = highlight
          setTimeout(() => (store.codeHighlight = null), 5000)
        }
      },
      onComplete: () => {
        store.isStreaming = false
      },
      onError: (error) => {
        console.error('Chat error:', error)
        const msg = store.messages.find((m) => m.id === assistantMessageId)
        if (msg) msg.content = 'Sorry, I encountered an error. Please try again.'
        store.isStreaming = false
      },
    })
  } catch (error) {
    console.error('Error sending message:', error)
    store.isStreaming = false
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="flex h-full flex-col backdrop-blur-md bg-white/40 dark:bg-slate-900/40">
    <!-- Exercise Description -->
    <Card class="m-4 border-primary/20 bg-gradient-to-r from-primary/5 to-blue-500/5">
      <CardContent class="flex items-start gap-3 p-4">
        <BookOpen class="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-foreground mb-2">Exercise</h3>
          <div class="relative">
            <p
              ref="exerciseRef"
              class="text-sm text-muted-foreground leading-relaxed whitespace-pre-line transition-all duration-300"
              :class="{ 'line-clamp-6': !isExerciseExpanded && shouldShowToggle }"
            >
              {{ store.exerciseDescription }}
            </p>
            <Button
              v-if="shouldShowToggle"
              variant="ghost"
              size="sm"
              class="mt-2 h-auto py-1 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
              @click="isExerciseExpanded = !isExerciseExpanded"
            >
              <ChevronUp v-if="isExerciseExpanded" class="h-3 w-3 mr-1" />
              <ChevronDown v-else class="h-3 w-3 mr-1" />
              {{ isExerciseExpanded ? 'Show less' : 'Show more' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Help Button Section -->
    <div class="border-b border-border bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
      <div class="flex items-center justify-between gap-4">
        <div class="flex-1">
          <h3 class="font-semibold text-foreground flex items-center gap-2">
            <HelpCircle class="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Need Guidance?
          </h3>
          <p class="mt-1 text-sm text-muted-foreground">
            Stuck on something? I'll analyze your code and provide helpful hints!
          </p>
        </div>
        <Button
          size="sm"
          :disabled="store.isStreaming"
          class="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          @click="handleGetHelp"
        >
          Get Help
        </Button>
      </div>
    </div>

    <!-- Messages -->
    <ScrollArea ref="scrollAreaRef" class="flex-1 p-4">
      <div class="flex flex-col gap-4">
        <div
          v-for="message in store.messages"
          :key="message.id"
          class="flex gap-3"
          :class="{ 'flex-row-reverse': message.role === 'user' }"
        >
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            :class="
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            "
          >
            <User v-if="message.role === 'user'" class="h-4 w-4" />
            <Bot v-else class="h-4 w-4" />
          </div>
          <div
            class="max-w-[80%] rounded-2xl px-4 py-2.5"
            :class="
              message.role === 'user'
                ? 'bg-primary/20 text-foreground'
                : 'bg-[var(--color-chat-tutor,theme(colors.neutral.100))] text-foreground'
            "
          >
            <p class="text-sm leading-relaxed whitespace-pre-wrap">
              {{
                message.content || (message.role === 'assistant' && store.isStreaming ? '...' : '')
              }}
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>

    <!-- Input Area -->
    <div class="border-t border-border p-4">
      <div class="flex items-center gap-2">
        <Input
          v-model="input"
          placeholder="Ask your tutor a question..."
          class="flex-1 border-border bg-secondary text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
          @keydown="handleKeyDown"
        />
        <Button
          size="icon"
          class="h-10 w-10 bg-gradient-to-br from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600 border-0"
          :disabled="!input.trim()"
          @click="handleSend"
        >
          <Send class="h-4 w-4" />
        </Button>
      </div>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        Press Enter to send • Shift+Enter for new line
      </p>
    </div>
  </div>
</template>
