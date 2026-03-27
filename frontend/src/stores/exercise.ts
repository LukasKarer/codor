import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Message, CodeHighlight } from '@/lib/ai'

export type { Message, CodeHighlight }

const initialCode = `function greet(name) {
  // This function greets the user
  const message = "Hello, " + name + "!";
  console.log(message);
  return message;
}

// Call the function
const result = greet("Learner");
console.log(result + " +1");`

const initialExerciseDescription = `In this exercise, you'll learn how to create and use functions in JavaScript. Your goal is to:
- Create a function called 'greet' that takes a person's name as input
- The function should create a greeting message with that name
- Print the greeting to the console
- Return the greeting so it can be used elsewhere
- Call the function with a name and use the returned value

Take your time and experiment! If you get stuck, click the "Get Help" button and I'll guide you without giving away the solution.`

const initialMessages: Message[] = [
  {
    id: 1,
    role: 'assistant',
    content:
      "Welcome! I'm your coding tutor. Read the exercise description above and start coding. If you need help, just click the 'Get Help' button and I'll guide you!",
    timestamp: new Date(),
  },
]

export const useExerciseStore = defineStore('exercise', () => {
  const code = ref(initialCode)
  const messages = ref<Message[]>(initialMessages)
  const exerciseDescription = ref(initialExerciseDescription)
  const codeHighlight = ref<CodeHighlight | null>(null)
  const isStreaming = ref(false)
  const exerciseId = ref<string | null>(null)
  const userId = ref<string | null>(null)
  const pushIntervalMs = ref(30000)

  return {
    code,
    messages,
    exerciseDescription,
    codeHighlight,
    isStreaming,
    exerciseId,
    userId,
    pushIntervalMs,
  }
})
