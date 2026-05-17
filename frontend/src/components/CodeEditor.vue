<script setup lang="ts">
import { ref, shallowRef, watch, onUnmounted, computed } from 'vue'
import { useMonacoTheme } from '@/composables/useMonacoTheme'
import { Play, Copy, Check } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'
import { Button } from '@/components/ui/button'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useExerciseStore } from '@/stores/exercise'
import type { editor as MonacoEditorType } from 'monaco-editor'
import { getRuntime } from '@/languages/registry'
import { LANGUAGE_META } from '@/languages/types'

type LogEntry = {
  type: 'log' | 'error' | 'warn' | 'info' | 'system'
  content: string
}

const props = defineProps<{
  readonly?: boolean
}>()

const { t } = useI18n()
const exerciseStore = useExerciseStore()
const monacoTheme = useMonacoTheme()
const copied = ref(false)
const logs = ref<LogEntry[]>([])
const workerRef = ref<Worker | null>(null)
const editorRef = shallowRef<MonacoEditorType.IStandaloneCodeEditor | null>(null)
const decorationsCollection = shallowRef<MonacoEditorType.IEditorDecorationsCollection | null>(null)

const currentLanguage = computed(() => exerciseStore.language)
const fileLabel = computed(() => {
  const meta = LANGUAGE_META[currentLanguage.value as keyof typeof LANGUAGE_META]
  return meta ? `lesson-01.${meta.extension}` : 'lesson-01.js'
})

function handleCopy() {
  navigator.clipboard.writeText(exerciseStore.code)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function handleRun() {
  logs.value = []
  if (workerRef.value) {
    workerRef.value.terminate()
  }

  const runtime = getRuntime(currentLanguage.value as any)
  if (!runtime.isReady) {
    logs.value.push({ type: 'info', content: `Loading ${runtime.name} runtime...` })
  }

  try {
    const result = await runtime.run(exerciseStore.code)
    if (result.stdout) {
      result.stdout.split('\n').forEach((line) => {
        if (line) logs.value.push({ type: 'log', content: line })
      })
    }
    if (result.stderr) {
      result.stderr.split('\n').forEach((line) => {
        if (line) logs.value.push({ type: 'error', content: line })
      })
    }
    if (result.exitCode !== 0 && !result.stderr) {
      logs.value.push({ type: 'error', content: `Exited with code ${result.exitCode}` })
    }
  } catch (e: any) {
    logs.value.push({ type: 'error', content: `Run error: ${e.message}` })
  }
}

function applyHighlight() {
  const editor = editorRef.value
  if (!editor) return

  if (!decorationsCollection.value) {
    decorationsCollection.value = editor.createDecorationsCollection([])
  }

  const highlight = exerciseStore.codeHighlight
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
watch(() => exerciseStore.codeHighlight, applyHighlight)

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
        <span class="ml-4 font-mono text-sm text-muted-foreground">{{ fileLabel }}</span>
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
          :disabled="props.readonly"
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
            :language="currentLanguage"
            :theme="monacoTheme"
            :value="exerciseStore.code"
            :options="{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: props.readonly ?? false,
            }"
            @change="(val: string | undefined) => { if (!props.readonly) exerciseStore.code = val || '' }"
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
              {{ t(L.editor.runToSeeOutput) }}
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
