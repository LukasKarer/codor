import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User, Session } from '@supabase/supabase-js'
import type { Message, Step, CodeHighlight } from '@/lib/ai'

export type { Message, Step, CodeHighlight }

const initialCode = `function greet(name) {
  // This function greets the user
  const message = "Hello, " + name + "!";
  console.log(message);
  return message;
}

// Call the function
const result = greet("Learner");
console.log(result + " +1");`

const initialSteps: Step[] = [
  {
    description: 'Define the `greet` function that accepts a `name` parameter.',
    lineStart: 1,
    lineEnd: 4,
  },
  {
    description:
      'Inside the function, create a variable `greeting` that concatenates "Hello, ", the provided `name`, and "!".',
    lineStart: 2,
    lineEnd: 2,
  },
  { description: 'Print the `greeting` variable to the console.', lineStart: 3, lineEnd: 3 },
  { description: 'Return the `greeting` variable from the function.', lineStart: 4, lineEnd: 4 },
  {
    description:
      'Call the `greet` function with the argument "Student" and store the returned value in a variable called `result`.',
    lineStart: 7,
    lineEnd: 7,
  },
  { description: 'Print the `result` variable to the console.', lineStart: 8, lineEnd: 8 },
]

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

export const useAppStore = defineStore('app', () => {
  // Auth state
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  // Role flags loaded from the DB profiles table after login
  const isTeacher = ref(false)
  const isAdmin = ref(false)
  // Organisation the user belongs to (null = no org assigned)
  const organisationId = ref<string | null>(null)

  // Exercise/student state
  const code = ref(initialCode)
  const messages = ref<Message[]>(initialMessages)
  const steps = ref<Step[]>(initialSteps)
  const exerciseDescription = ref(initialExerciseDescription)
  const codeHighlight = ref<CodeHighlight | null>(null)
  const isStreaming = ref(false)
  const exerciseId = ref<string | null>(null)
  const userId = ref<string | null>(null)

  // Config
  const pushIntervalMs = ref(30000)

  return {
    // auth
    user,
    session,
    isTeacher,
    isAdmin,
    organisationId,
    // exercise
    code,
    messages,
    steps,
    exerciseDescription,
    codeHighlight,
    isStreaming,
    exerciseId,
    userId,
    // config
    pushIntervalMs,
  }
})
