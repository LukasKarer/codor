<script setup lang="ts">
import { ref, shallowRef, watch, onUnmounted } from 'vue'
import { Play, Copy, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useAppStore } from '@/stores/app'
import type { editor as MonacoEditorType } from 'monaco-editor'

type LogEntry = {
  type: 'log' | 'error' | 'warn' | 'info' | 'system'
  content: string
}

const store = useAppStore()
const copied = ref(false)
const logs = ref<LogEntry[]>([])
const workerRef = ref<Worker | null>(null)
const editorRef = shallowRef<MonacoEditorType.IStandaloneCodeEditor | null>(null)
const decorationsCollection = shallowRef<MonacoEditorType.IEditorDecorationsCollection | null>(null)

function handleCopy() {
  navigator.clipboard.writeText(store.code)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function handleRun() {
  logs.value = []
  if (workerRef.value) {
    workerRef.value.terminate()
  }

  const worker = new Worker(new URL('../workers/codeExecutor.ts', import.meta.url), {
    type: 'module',
  })
  workerRef.value = worker

  worker.onmessage = (e) => {
    const { type, level, args, message, line } = e.data
    if (type === 'console') {
      logs.value.push({ type: level, content: args.join(' ') })
    } else if (type === 'error') {
      logs.value.push({ type: 'error', content: `Error: ${message}` })
    } else if (type === 'editor' && e.data.action === 'highlightError') {
      logs.value.push({ type: 'error', content: `[Editor Highlight] Line ${line}: ${message}` })
    } else if (type === 'ai') {
      logs.value.push({
        type: 'info',
        content: `[AI Call] ${e.data.functionName}(${e.data.args.join(', ')})`,
      })
    }
  }

  worker.onerror = (err) => {
    logs.value.push({ type: 'error', content: `Worker Error: ${err.message}` })
  }

  worker.postMessage(store.code)
}

function applyHighlight() {
  const editor = editorRef.value
  if (!editor) return

  if (!decorationsCollection.value) {
    decorationsCollection.value = editor.createDecorationsCollection([])
  }

  const highlight = store.codeHighlight
  if (!highlight) {
    decorationsCollection.value.clear()
    return
  }

  const { startLine, startColumn, endLine, endColumn } = highlight
  decorationsCollection.value.set([
    {
      range: {
        startLineNumber: startLine,
        startColumn: startColumn || 1,
        endLineNumber: endLine,
        endColumn: endColumn || 1000,
      },
      options: {
        isWholeLine: !startColumn && !endColumn,
        className: 'highlighted-code-line',
        inlineClassName: 'highlighted-code-inline',
      },
    },
  ])

  editor.revealLineInCenter(startLine)
}

function handleEditorMount(editor: MonacoEditorType.IStandaloneCodeEditor) {
  editorRef.value = editor
  decorationsCollection.value = editor.createDecorationsCollection([])
  // Apply any highlight that was set before the editor was ready
  applyHighlight()
}

// Watch for AI code highlight changes
watch(() => store.codeHighlight, applyHighlight)

onUnmounted(() => {
  if (workerRef.value) {
    workerRef.value.terminate()
  }
})
</script>

<template>
  <div class="flex h-full flex-col bg-[var(--color-code-bg,theme(colors.neutral.50))]">
    <!-- Editor Header -->
    <div class="flex items-center justify-between border-b border-border px-4 py-2">
      <div class="flex items-center gap-2">
        <span class="ml-4 font-mono text-sm text-muted-foreground">lesson-01.js</span>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 gap-1.5 text-muted-foreground"
          @click="handleCopy"
        >
          <Check v-if="copied" class="h-4 w-4 text-primary" />
          <Copy v-else class="h-4 w-4" />
          <span class="text-xs">{{ copied ? 'Copied' : 'Copy' }}</span>
        </Button>
        <Button
          size="sm"
          class="h-8 gap-1.5 text-primary-foreground bg-gradient-to-br from-purple-600 to-blue-500"
          @click="handleRun"
        >
          <Play class="h-4 w-4" />
          <span class="text-xs">Run</span>
        </Button>
      </div>
    </div>

    <!-- Code Area and Output Panel -->
    <ResizablePanelGroup direction="vertical" class="flex-1">
      <ResizablePanel :default-size="75" :min-size="20">
        <div class="h-full w-full overflow-hidden">
          <VueMonacoEditor
            height="100%"
            language="javascript"
            theme="vs-dark"
            :value="store.code"
            :options="{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }"
            @change="(val: string | undefined) => (store.code = val || '')"
            @mount="handleEditorMount"
          />
        </div>
      </ResizablePanel>

      <ResizableHandle class="h-4 bg-border transition-colors hover:bg-primary/50" />

      <ResizablePanel :default-size="25" :min-size="10">
        <div class="flex h-full flex-col border-t border-border">
          <div class="flex items-center gap-2 border-b border-border px-4 py-2">
            <span class="font-mono text-xs font-medium text-muted-foreground">OUTPUT</span>
          </div>
          <div
            class="flex-1 overflow-auto p-4 font-mono text-sm text-muted-foreground scrollbar-thin"
          >
            <p v-if="logs.length === 0" class="text-muted-foreground/50 italic">
              Run code to see output...
            </p>
            <p
              v-for="(log, i) in logs"
              :key="i"
              class="whitespace-pre-wrap"
              :class="{
                'text-red-400': log.type === 'error',
                'text-blue-400': log.type === 'info',
                'text-[var(--color-code-string)]': log.type === 'log',
              }"
            >
              &gt; {{ log.content }}
            </p>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
