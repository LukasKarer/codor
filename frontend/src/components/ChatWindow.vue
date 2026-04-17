<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Send, Bot, BotOff, User, HelpCircle, BookOpen, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { useExerciseStore } from '@/stores/exercise'
import { streamChat, handleHighlightCode, getLLMHelp } from '@/lib/ai'
import { saveAiInteraction } from '@/lib/api'
import { AI_MODE_ENABLED, AI_MODE_DISABLED } from '@/components/exam/constants'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'

const { t } = useI18n()

const props = defineProps<{
  aiChatMode?: 'enabled' | 'restricted' | 'disabled'
  locked?: boolean
  exerciseTitle?: string
}>()

const exerciseStore = useExerciseStore()

const effectiveAiMode = computed<'enabled' | 'restricted' | 'disabled'>(
  () => props.locked ? AI_MODE_DISABLED : (props.aiChatMode ?? AI_MODE_ENABLED),
)
const isChatInputDisabled = computed(() => effectiveAiMode.value !== AI_MODE_ENABLED)
const isGetHelpDisabled = computed(
  () => effectiveAiMode.value === AI_MODE_DISABLED || exerciseStore.isStreaming,
)
const input = ref('')
const isExerciseExpanded = ref(false)
const shouldShowToggle = ref(false)
const scrollAreaRef = ref<HTMLElement | null>(null)
const exerciseRef = ref<HTMLParagraphElement | null>(null)

// Scroll to bottom when messages change
watch(
  () => exerciseStore.messages.length,
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
  () => exerciseStore.exerciseDescription,
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
  if (isGetHelpDisabled.value) return

  exerciseStore.isStreaming = true
  const helpMessageId = Date.now()
  exerciseStore.messages.push({
    id: helpMessageId,
    role: 'assistant',
    content: 'Let me take a look at your code and help you out...',
    timestamp: new Date(),
  })

  let accumulatedContent = ''

  try {
    await getLLMHelp(
      exerciseStore.code,
      exerciseStore.exerciseDescription,
      [],
      (chunk) => {
        accumulatedContent += chunk
        const msg = exerciseStore.messages.find((m) => m.id === helpMessageId)
        if (msg) msg.content = accumulatedContent
      },
      (functionCall) => {
        if (functionCall.name === 'highlight_code') {
          const highlight = handleHighlightCode(functionCall.args)
          exerciseStore.codeHighlight = highlight
          setTimeout(() => (exerciseStore.codeHighlight = null), 5000)
        }
      },
      () => {
        if (exerciseStore.exerciseId && accumulatedContent.trim()) {
          saveAiInteraction(exerciseStore.exerciseId, {
            promptType: 'get-help',
            userMessage: null,
            assistantMessage: accumulatedContent,
          }).catch((e) => console.error('Failed to persist get-help interaction:', e))
        }
        exerciseStore.isStreaming = false
      },
      (error) => {
        console.error('Get help error:', error)
        const msg = exerciseStore.messages.find((m) => m.id === helpMessageId)
        if (msg)
          msg.content = t(L.chat.errorAnalyzing)
        exerciseStore.isStreaming = false
      },
    )
  } catch (error) {
    console.error('Error getting help:', error)
    exerciseStore.isStreaming = false
  }
}

async function handleSend() {
  if (!input.value.trim() || exerciseStore.isStreaming || isChatInputDisabled.value) return

  const userMessage = {
    id: Date.now(),
    role: 'user' as const,
    content: input.value.trim(),
    timestamp: new Date(),
  }

  exerciseStore.messages.push(userMessage)
  input.value = ''
  exerciseStore.isStreaming = true

  const assistantMessageId = Date.now() + 1
  exerciseStore.messages.push({
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
  })

  let accumulatedContent = ''

  try {
    await streamChat([...exerciseStore.messages.slice(0, -1)], exerciseStore.code, {
      onTextChunk: (chunk) => {
        accumulatedContent += chunk
        const msg = exerciseStore.messages.find((m) => m.id === assistantMessageId)
        if (msg) msg.content = accumulatedContent
      },
      onFunctionCall: (functionCall) => {
        if (functionCall.name === 'highlight_code') {
          const highlight = handleHighlightCode(functionCall.args)
          exerciseStore.codeHighlight = highlight
          setTimeout(() => (exerciseStore.codeHighlight = null), 5000)
        }
      },
      onComplete: () => {
        if (exerciseStore.exerciseId && accumulatedContent.trim()) {
          saveAiInteraction(exerciseStore.exerciseId, {
            promptType: 'chat',
            userMessage: userMessage.content,
            assistantMessage: accumulatedContent,
          }).catch((e) => console.error('Failed to persist chat interaction:', e))
        }
        exerciseStore.isStreaming = false
      },
      onError: (error) => {
        console.error('Chat error:', error)
        const msg = exerciseStore.messages.find((m) => m.id === assistantMessageId)
        if (msg) msg.content = t(L.chat.errorGeneral)
        exerciseStore.isStreaming = false
      },
    })
  } catch (error) {
    console.error('Error sending message:', error)
    exerciseStore.isStreaming = false
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
  <div class="flex h-full flex-col overflow-hidden backdrop-blur-md bg-white/40 dark:bg-slate-900/40">
    <!-- Scrollable area: exercise, help button, and messages -->
    <ScrollArea ref="scrollAreaRef" class="flex-1 min-h-0">
      <div class="flex flex-col">
        <!-- Exercise Description -->
        <Card class="m-4 border-primary/20 bg-gradient-to-r from-primary/5 to-blue-500/5">
          <CardContent class="flex items-start gap-3 px-4">
            <div class="flex-1 min-w-0">
              <div class="flex gap-2">
                <BookOpen class="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <h3 class="font-semibold text-foreground mb-2 leading-5">{{ exerciseTitle || t(L.student.lesson) }}</h3>
              </div>
              <div class="relative">
                <p
                  ref="exerciseRef"
                  class="text-sm text-muted-foreground leading-relaxed whitespace-pre-line transition-all duration-300"
                  :class="{ 'line-clamp-6': !isExerciseExpanded && shouldShowToggle }"
                >
                  {{ exerciseStore.exerciseDescription }}
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
                  {{ isExerciseExpanded ? t(L.chat.showLess) : t(L.chat.showMore) }}
                </Button>
              </div>

              <!-- Learning Steps -->
              <ol v-if="exerciseStore.steps.length" class="mt-3 space-y-2">
                <li
                  v-for="(step, index) in exerciseStore.steps"
                  :key="index"
                  class="flex gap-2.5 text-sm"
                >
                  <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {{ index + 1 }}
                  </span>
                  <span class="flex-1 text-muted-foreground leading-relaxed">
                    {{ step.description }}
                    <span class="ml-1 whitespace-nowrap text-xs text-muted-foreground/60">
                      ({{ step.lineStart === step.lineEnd ? `L${step.lineStart}` : `L${step.lineStart}–${step.lineEnd}` }})
                    </span>
                  </span>
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <!-- AI fully disabled for this exam: show notice instead of help + messages -->
        <div
          v-if="props.aiChatMode === AI_MODE_DISABLED"
          class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BotOff class="h-6 w-6 text-muted-foreground" />
          </div>
          <p class="text-sm text-muted-foreground">{{ t(L.chat.aiDisabled) }}</p>
        </div>

        <template v-else>
          <!-- Help Button Section -->
          <div class="border-b border-border bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
            <div class="flex items-center justify-between gap-4">
              <div class="flex-1">
                <h3 class="font-semibold text-foreground flex items-center gap-2">
                  <HelpCircle class="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  {{ t(L.chat.needGuidance) }}
                </h3>
                <p class="mt-1 text-sm text-muted-foreground">
                  {{ t(L.chat.guidanceDescription) }}
                </p>
              </div>
              <Button
                size="sm"
                :disabled="isGetHelpDisabled"
                class="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                @click="handleGetHelp"
              >
                {{ t(L.chat.getHelp) }}
              </Button>
            </div>
          </div>

          <!-- Messages -->
          <div class="flex flex-col gap-4 p-4">
            <div
              v-for="message in exerciseStore.messages"
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
                    message.content ||
                    (message.role === 'assistant' && exerciseStore.isStreaming ? '...' : '')
                  }}
                </p>
              </div>
            </div>
          </div>
        </template>
      </div>
    </ScrollArea>

    <!-- Input Area (hidden when AI is exam-disabled; notice is shown inline above instead) -->
    <div v-if="props.aiChatMode !== AI_MODE_DISABLED" class="border-t border-border p-4">
      <!-- AI fully disabled: no chat, no input -->
      <p v-if="effectiveAiMode === AI_MODE_DISABLED" class="text-center text-sm text-muted-foreground py-2">
        {{ props.locked ? t(L.chat.submittedDisabled) : t(L.chat.aiDisabled) }}
      </p>

      <!-- Chat available (enabled or restricted) -->
      <template v-else>
        <div class="flex items-center gap-2">
          <Input
            v-model="input"
            :placeholder="t(L.chat.placeholder)"
            :disabled="isChatInputDisabled"
            class="flex-1 border-border bg-secondary text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
            @keydown="handleKeyDown"
          />
          <Button
            size="icon"
            class="h-10 w-10 bg-gradient-to-br from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600 border-0"
            :disabled="!input.trim() || isChatInputDisabled"
            @click="handleSend"
          >
            <Send class="h-4 w-4" />
          </Button>
        </div>
        <p class="mt-2 text-center text-xs text-muted-foreground">
          <span v-if="isChatInputDisabled">{{ t(L.chat.hintsOnly) }}</span>
          <span v-else>{{ t(L.chat.pressEnter) }}</span>
        </p>
      </template>
    </div>
  </div>
</template>
