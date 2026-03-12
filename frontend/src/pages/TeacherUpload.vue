<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Upload,
  Code,
  Target,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { generateTasks, generateDescription } from '@/lib/ai'
import type { Step as AIStep } from '@/lib/ai'
import { createExercise, serializeExerciseContent } from '@/lib/api'
import { toast } from 'vue-sonner'
import type { editor as MonacoEditorType } from 'monaco-editor'

interface Step extends AIStep {
  id: number
}

// Decoration CSS classes injected once into the Monaco environment
// Each index maps to a Tailwind-like color
const STEP_DECORATION_CLASSES = [
  'teacher-step-purple',
  'teacher-step-blue',
  'teacher-step-cyan',
  'teacher-step-green',
  'teacher-step-yellow',
  'teacher-step-orange',
  'teacher-step-red',
]

const router = useRouter()
const isGenerating = ref(false)
const isGeneratingDescription = ref(false)
const isPublishing = ref(false)
const title = ref('Build a Greeting Function')
const code = ref(`function greet(name) {
  const greeting = "Hello, " + name + "!";
  console.log(greeting);
  return greeting;
}

const result = greet("Student");
console.log(result);`)
const description = ref('')
const steps = ref<Step[]>([])
const selectedStep = ref<number | null>(null)
const hoveredStep = ref<number | null>(null)
const editingStep = ref<number | null>(null)

const editorRef = shallowRef<MonacoEditorType.IStandaloneCodeEditor | null>(null)
const decorationsCollection = shallowRef<MonacoEditorType.IEditorDecorationsCollection | null>(null)

const getStepColorClass = (stepId: number) =>
  STEP_DECORATION_CLASSES[(stepId - 1) % STEP_DECORATION_CLASSES.length]

// Tailwind sidebar color objects used only for the step cards on the right
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

function injectDecorationStyles() {
  const id = 'teacher-step-styles'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `
    .teacher-step-purple        { background: rgba(168,85,247,0.15) !important; }
    .teacher-step-blue          { background: rgba(59,130,246,0.15) !important; }
    .teacher-step-cyan          { background: rgba(6,182,212,0.15) !important; }
    .teacher-step-green         { background: rgba(34,197,94,0.15) !important; }
    .teacher-step-yellow        { background: rgba(234,179,8,0.15) !important; }
    .teacher-step-orange        { background: rgba(249,115,22,0.15) !important; }
    .teacher-step-red           { background: rgba(239,68,68,0.15) !important; }
    .teacher-step-purple-margin { background: rgba(168,85,247,0.8) !important; width: 3px !important; }
    .teacher-step-blue-margin   { background: rgba(59,130,246,0.8) !important; width: 3px !important; }
    .teacher-step-cyan-margin   { background: rgba(6,182,212,0.8) !important; width: 3px !important; }
    .teacher-step-green-margin  { background: rgba(34,197,94,0.8) !important; width: 3px !important; }
    .teacher-step-yellow-margin { background: rgba(234,179,8,0.8) !important; width: 3px !important; }
    .teacher-step-orange-margin { background: rgba(249,115,22,0.8) !important; width: 3px !important; }
    .teacher-step-red-margin    { background: rgba(239,68,68,0.8) !important; width: 3px !important; }
  `
  document.head.appendChild(style)
}

function applyDecorations() {
  const editor = editorRef.value
  if (!editor) return

  if (!decorationsCollection.value) {
    decorationsCollection.value = editor.createDecorationsCollection([])
  }

  const active = hoveredStep.value ?? selectedStep.value
  if (active === null) {
    decorationsCollection.value.clear()
    return
  }

  const step = steps.value.find((s) => s.id === active)
  if (!step) {
    decorationsCollection.value.clear()
    return
  }

  decorationsCollection.value.set([
    {
      range: {
        startLineNumber: step.lineStart,
        startColumn: 1,
        endLineNumber: step.lineEnd,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: getStepColorClass(step.id),
        marginClassName: `${getStepColorClass(step.id)}-margin`,
      },
    },
  ])

  editor.revealLineInCenter(step.lineStart)
}

watch([hoveredStep, selectedStep], applyDecorations)
// Re-apply when steps array changes (e.g. after AI generation)
watch(steps, applyDecorations, { deep: true })

function handleEditorMount(editor: MonacoEditorType.IStandaloneCodeEditor) {
  editorRef.value = editor
  decorationsCollection.value = editor.createDecorationsCollection([])
  injectDecorationStyles()
}

const addStep = () => {
  const newId = Math.max(...steps.value.map((s) => s.id), 0) + 1
  steps.value.push({ id: newId, description: '', lineStart: 1, lineEnd: 1 })
}

const addStepAfter = (afterId: number) => {
  const afterIndex = steps.value.findIndex((s) => s.id === afterId)
  const afterStep = steps.value[afterIndex]
  if (!afterStep) return
  const nextStep = steps.value[afterIndex + 1]
  const newLineStart = afterStep.lineEnd + 1
  const newLineEnd = nextStep ? Math.min(newLineStart, nextStep.lineStart - 1) : newLineStart
  const newId = Math.max(...steps.value.map((s) => s.id), 0) + 1
  const newStep: Step = {
    id: newId,
    description: '',
    lineStart: newLineStart <= newLineEnd ? newLineStart : afterStep.lineEnd,
    lineEnd: newLineStart <= newLineEnd ? newLineEnd : afterStep.lineEnd,
  }
  steps.value.splice(afterIndex + 1, 0, newStep)
  editingStep.value = newId
}

const removeStep = (id: number) => {
  steps.value = steps.value.filter((s) => s.id !== id)
}

const updateStep = (id: number, field: keyof Step, value: string | number) => {
  const step = steps.value.find((s) => s.id === id)
  if (step) (step as Record<string, unknown>)[field] = value
}

const handleGenerateTasks = async () => {
  if (!code.value || !description.value) return
  isGenerating.value = true
  try {
    const generated = await generateTasks(code.value, description.value)
    steps.value = generated.map((s, idx) => ({ ...s, id: idx + 1 }))
  } catch (e) {
    console.error('Failed to generate tasks:', e)
  } finally {
    isGenerating.value = false
  }
}

const handleGenerateDescription = async () => {
  if (!code.value) return
  isGeneratingDescription.value = true
  try {
    description.value = await generateDescription(code.value)
  } catch (e) {
    console.error('Failed to generate description:', e)
  } finally {
    isGeneratingDescription.value = false
  }
}

const handleSubmit = async () => {
  if (
    !title.value.trim() ||
    !code.value.trim() ||
    !description.value.trim() ||
    steps.value.length === 0
  ) {
    toast.error('Missing Information', {
      description: 'Please fill in all fields and add at least one step.',
    })
    return
  }

  isPublishing.value = true
  try {
    const content = serializeExerciseContent({
      title: title.value,
      code: code.value,
      description: description.value,
      steps: steps.value.map(({ description: desc, lineStart, lineEnd }) => ({
        description: desc,
        lineStart,
        lineEnd,
      })),
    })

    const exercise = await createExercise(content)

    // toast.success('Exercise Published!', {
    //   description: `Exercise created with ID: ${exercise.sub}`,
    // })

    localStorage.setItem('lastCreatedExerciseId', exercise.sub)

    setTimeout(() => router.push('/teacher'), 1500)
  } catch (e) {
    console.error('Failed to publish exercise:', e)
    toast.error('Publication Failed', {
      description: e instanceof Error ? e.message : 'Failed to create exercise',
    })
  } finally {
    isPublishing.value = false
  }
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- Header -->
    <header class="border-b border-border px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" class="h-9 w-9" @click="router.push('/teacher')">
            <ArrowLeft class="h-5 w-5" />
          </Button>
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-500"
          >
            <Code class="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 class="font-semibold text-foreground">Teacher Dashboard</h1>
            <p class="text-xs text-muted-foreground">Create a new coding task</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Button
            class="bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-700 hover:to-blue-600"
            :disabled="isPublishing"
            @click="handleSubmit"
          >
            <Loader2 v-if="isPublishing" class="mr-2 h-4 w-4 animate-spin" />
            <Upload v-else class="mr-2 h-4 w-4" />
            {{ isPublishing ? 'Publishing...' : 'Publish Task' }}
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex flex-1 overflow-hidden">
      <!-- Left Side: Title & Code -->
      <div class="flex w-1/2 flex-col border-r border-border">
        <div class="border-b border-border p-4">
          <Label for="exercise-title" class="text-sm font-medium">Exercise Title</Label>
          <Input
            id="exercise-title"
            v-model="title"
            placeholder="e.g., Build a greeting function"
            class="mt-2"
          />
        </div>

        <div class="flex flex-1 flex-col overflow-hidden">
          <div class="border-b border-border px-4 py-2">
            <span class="font-mono text-sm font-medium text-muted-foreground">
              Teacher's Solution Code
            </span>
          </div>

          <div class="flex-1 overflow-hidden">
            <VueMonacoEditor
              v-model:value="code"
              language="javascript"
              theme="vs-dark"
              :options="{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
              }"
              class="h-full w-full"
              @mount="handleEditorMount"
            />
          </div>
        </div>
      </div>

      <!-- Right Side: Description & Steps -->
      <div class="flex w-1/2 flex-col overflow-auto scrollbar-thin p-6 space-y-6">
        <!-- Task Description -->
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="flex items-center gap-2">
                  <Target class="h-5 w-5 text-primary" />
                  Task Description
                </CardTitle>
                <CardDescription>AI-generated task overview (editable)</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                :disabled="isGeneratingDescription"
                @click="handleGenerateDescription"
              >
                <Loader2 v-if="isGeneratingDescription" class="mr-2 h-4 w-4 animate-spin" />
                <Target v-else class="mr-2 h-4 w-4" />
                {{ isGeneratingDescription ? 'Generating...' : 'Generate Description' }}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              v-model="description"
              placeholder="The AI will generate a description based on your code..."
              :rows="6"
            />
          </CardContent>
        </Card>

        <!-- Steps -->
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="flex items-center gap-2">
                  <CheckCircle2 class="h-5 w-5 text-primary" />
                  Learning Steps
                </CardTitle>
                <CardDescription>AI-generated steps linked to code lines</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                :disabled="isGenerating"
                @click="handleGenerateTasks"
              >
                <Loader2 v-if="isGenerating" class="mr-2 h-4 w-4 animate-spin" />
                <Target v-else class="mr-2 h-4 w-4" />
                {{ isGenerating ? 'Generating...' : 'Generate Tasks' }}
              </Button>
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <div v-for="(step, index) in steps" :key="step.id">
              <div
                :class="[
                  'rounded-lg border-2 p-4 transition-all cursor-pointer backdrop-blur-md bg-white/40 dark:bg-slate-900/40',
                  selectedStep === step.id || hoveredStep === step.id
                    ? `${getStepColor(step.id).border} ${getStepColor(step.id).bg}`
                    : 'border-border hover:border-muted-foreground/50',
                ]"
                @click="
                  () => {
                    selectedStep = step.id === selectedStep ? null : step.id
                    editingStep = editingStep === step.id ? null : step.id
                  }
                "
                @mouseenter="hoveredStep = step.id"
                @mouseleave="hoveredStep = null"
              >
                <div class="mb-3 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div
                      :class="[
                        'h-6 w-6 rounded-full flex items-center justify-center',
                        getStepColor(step.id).line,
                      ]"
                    >
                      <span class="text-xs font-bold text-white">{{ index + 1 }}</span>
                    </div>
                    <span class="text-xs text-muted-foreground">
                      Lines {{ step.lineStart }}-{{ step.lineEnd }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Button
                      v-if="steps.length > 1"
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6 text-destructive hover:text-destructive"
                      @click.stop="removeStep(step.id)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div class="space-y-3">
                  <div>
                    <Textarea
                      v-if="editingStep === step.id"
                      :model-value="step.description"
                      placeholder="Describe this step..."
                      :rows="2"
                      class="text-sm"
                      autofocus
                      @update:model-value="(v) => updateStep(step.id, 'description', v)"
                      @click.stop
                    />
                    <p v-else class="text-sm text-foreground leading-relaxed">
                      {{ step.description || 'Click to add a description...' }}
                    </p>
                  </div>

                  <div v-if="editingStep === step.id" class="flex gap-3">
                    <div class="flex-1">
                      <Label class="text-xs">Start Line</Label>
                      <Input
                        type="number"
                        min="1"
                        :model-value="step.lineStart"
                        class="mt-1 h-8 text-xs"
                        @update:model-value="
                          (v) => updateStep(step.id, 'lineStart', parseInt(String(v)) || 1)
                        "
                        @click.stop
                      />
                    </div>
                    <div class="flex-1">
                      <Label class="text-xs">End Line</Label>
                      <Input
                        type="number"
                        min="1"
                        :model-value="step.lineEnd"
                        class="mt-1 h-8 text-xs"
                        @update:model-value="
                          (v) => updateStep(step.id, 'lineEnd', parseInt(String(v)) || 1)
                        "
                        @click.stop
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Add Step Button Between Steps -->
              <div v-if="index < steps.length - 1" class="flex justify-center py-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-6 w-6 rounded-full p-0 hover:bg-primary/10"
                  @click="addStepAfter(step.id)"
                >
                  <Plus class="h-4 w-4 text-primary" />
                </Button>
              </div>
            </div>

            <!-- Add Step at End -->
            <div class="flex justify-center pt-2">
              <Button type="button" size="sm" variant="outline" class="w-full" @click="addStep">
                <Plus class="mr-1 h-4 w-4" />
                Add Manual Step
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  </div>
</template>
