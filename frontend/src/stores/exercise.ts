import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'
import type { Message, CodeHighlight, Step } from '@/lib/ai'
import type { ExamSettings } from '@/lib/api'

export type { Message, CodeHighlight, Step }

const WELCOME_MESSAGE_ID = 1

const initialCode = `function greet(name) {
  // This function greets the user
  const message = "Hello, " + name + "!";
  console.log(message);
  return message;
}

// Call the function
const result = greet("Learner");
console.log(result + " +1");`

export const useExerciseStore = defineStore('exercise', () => {
  const { t } = useI18n()

  const welcomeText = computed(() => t(L.student.welcomeMessage))
  const defaultDescription = computed(() => t(L.student.defaultExerciseDescription))

  function makeWelcomeMessage(): Message {
    return {
      id: WELCOME_MESSAGE_ID,
      role: 'assistant',
      content: welcomeText.value,
      timestamp: new Date(),
    }
  }

  const code = ref(initialCode)
  const messages = ref<Message[]>([makeWelcomeMessage()])
  const exerciseDescription = ref(defaultDescription.value)
  const steps = ref<Step[]>([])
  const codeHighlight = ref<CodeHighlight | null>(null)
  const isStreaming = ref(false)
  const exerciseId = ref<string | null>(null)
  const userId = ref<string | null>(null)
  const pushIntervalMs = ref(30000)
  const examSettings = ref<ExamSettings | null>(null)
  const isExerciseLocked = ref(false)
  const submittedAt = ref<number | null>(null)
  const isFinished = ref(false)
  const entryCreationTime = ref<number | null>(null)

  // Keep welcome message in sync with locale while chat is still at initial state
  watch(welcomeText, (text) => {
    const first = messages.value[0]
    if (first?.id === WELCOME_MESSAGE_ID) {
      first.content = text
    }
  })

  // Keep default description in sync unless an exercise has been loaded
  watch(defaultDescription, (text) => {
    if (!exerciseId.value) {
      exerciseDescription.value = text
    }
  })

  function resetForExerciseSwitch() {
    codeHighlight.value = null
    isStreaming.value = false
    messages.value = [makeWelcomeMessage()]
    isExerciseLocked.value = false
    submittedAt.value = null
    isFinished.value = false
    entryCreationTime.value = null
    steps.value = []
  }

  return {
    code,
    messages,
    exerciseDescription,
    steps,
    codeHighlight,
    isStreaming,
    exerciseId,
    userId,
    pushIntervalMs,
    examSettings,
    isExerciseLocked,
    submittedAt,
    entryCreationTime,
    isFinished,
    resetForExerciseSwitch,
  }
})
