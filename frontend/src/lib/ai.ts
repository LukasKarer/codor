import { getAuthToken } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface CodeHighlight {
  startLine: number
  startColumn?: number
  endLine: number
  endColumn?: number
}

export interface Step {
  description: string
  lineStart: number
  lineEnd: number
}

export interface FunctionCallArgs {
  name: string
  args: Record<string, unknown>
}

export interface StreamCallbacks {
  onTextChunk?: (text: string) => void
  onFunctionCall?: (functionCall: FunctionCallArgs) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

// ─── SSE streaming helper ──────────────────────────────────────────────────

async function consumeSSE(
  endpoint: string,
  body: unknown,
  callbacks: StreamCallbacks,
): Promise<void> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`AI request failed: ${response.status} ${text}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Parse SSE lines out of the buffer
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    let currentEvent = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6))
        if (currentEvent === 'text') {
          callbacks.onTextChunk?.(data.text)
        } else if (currentEvent === 'function_call') {
          callbacks.onFunctionCall?.({ name: data.name, args: data.args })
        } else if (currentEvent === 'done') {
          callbacks.onComplete?.()
          return
        } else if (currentEvent === 'error') {
          throw new Error(data.message ?? 'Unknown AI error')
        }
        currentEvent = ''
      }
    }
  }

  // If stream ends without an explicit 'done' event, still call complete
  callbacks.onComplete?.()
}

// ─── Public API (same signatures as before) ────────────────────────────────

function getLocale(): string {
  return localStorage.getItem('locale') ?? 'de'
}

export async function streamChat(
  messages: Message[],
  currentCode: string,
  callbacks: StreamCallbacks,
  programmingLanguage?: string,
): Promise<void> {
  try {
    await consumeSSE(
      '/v1/ai/chat',
      {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        currentCode,
        language: getLocale(),
        programmingLanguage,
      },
      callbacks,
    )
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error('Unknown error'))
  }
}

export function handleHighlightCode(args: Record<string, unknown>): CodeHighlight {
  return {
    startLine: args.start_line as number,
    startColumn: (args.start_column as number) || 1,
    endLine: args.end_line as number,
    endColumn: (args.end_column as number) || 1,
  }
}

export async function explainStep(
  step: Step,
  code: string,
  exerciseDescription: string,
  onTextChunk: (text: string) => void,
  onFunctionCall: (call: FunctionCallArgs) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  programmingLanguage?: string,
) {
  try {
    await consumeSSE(
      '/v1/ai/explain-step',
      { step, code, exerciseDescription, language: getLocale(), programmingLanguage },
      { onTextChunk, onFunctionCall, onComplete, onError },
    )
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Unknown error'))
  }
}

export async function getLLMHelp(
  code: string,
  exerciseDescription: string,
  tasksOutline: Step[],
  onTextChunk: (text: string) => void,
  onFunctionCall: (call: FunctionCallArgs) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  programmingLanguage?: string,
) {
  try {
    await consumeSSE(
      '/v1/ai/get-help',
      { code, exerciseDescription, tasksOutline, language: getLocale(), programmingLanguage },
      { onTextChunk, onFunctionCall, onComplete, onError },
    )
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Unknown error'))
  }
}

export async function generateTasks(
  code: string,
  description: string,
  programmingLanguage?: string,
): Promise<Step[]> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`${API_BASE_URL}/v1/ai/generate-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code, description, programmingLanguage }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`generateTasks failed: ${response.status} ${text}`)
  }
  const data = await response.json()
  return data.tasks as Step[]
}

export async function generateDescription(
  code: string,
  programmingLanguage?: string,
): Promise<string> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`${API_BASE_URL}/v1/ai/generate-description`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code, programmingLanguage }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`generateDescription failed: ${response.status} ${text}`)
  }
  const data = await response.json()
  return data.description as string
}
