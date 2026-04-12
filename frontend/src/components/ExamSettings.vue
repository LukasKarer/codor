<script setup lang="ts">
import { ref, watch } from 'vue'
import { Clock } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ExamSettings } from '@/lib/api'
import { DEFAULT_TIME_LIMIT_MINUTES, AI_MODE_ENABLED } from '@/components/exam/constants'

const model = defineModel<ExamSettings | null>({ default: null })

const examEnabled = ref(false)
const examTimeLimitEnabled = ref(false)
const examTimeLimitMinutes = ref<number>(DEFAULT_TIME_LIMIT_MINUTES)
const examSubmitAndLock = ref(false)
const examAiChatMode = ref<ExamSettings['aiChatMode']>(AI_MODE_ENABLED)

watch(
    [examEnabled, examTimeLimitEnabled, examTimeLimitMinutes, examSubmitAndLock, examAiChatMode],
    () => {
        if (!examEnabled.value) {
            model.value = null
            return
        }
        const hasAnyOption =
            examTimeLimitEnabled.value ||
            examSubmitAndLock.value ||
            examAiChatMode.value !== AI_MODE_ENABLED
        model.value = hasAnyOption
            ? {
                timeLimitMinutes: examTimeLimitEnabled.value ? examTimeLimitMinutes.value : null,
                submitAndLock: examSubmitAndLock.value,
                aiChatMode: examAiChatMode.value,
            }
            : null
    },
)
</script>

<template>
    <Card>
        <CardHeader>
            <div class="flex items-center gap-3">
                <div>
                    <CardTitle class="flex items-center gap-2">
                        <Clock class="h-5 w-5 text-primary" />
                        <Label for="exam-enabled" class="cursor-pointer text-base font-semibold">
                            Exam Settings
                        </Label>
                    </CardTitle>
                    <CardDescription>Optional restrictions applied during student sessions</CardDescription>
                </div>
                <div class="flex-1" />
                <label for="exam-enabled" class="relative inline-flex items-center cursor-pointer">
                    <input id="exam-enabled" v-model="examEnabled" type="checkbox" class="sr-only peer" />
                    <div
                        class="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-muted-foreground after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary">
                    </div>
                </label>
            </div>
        </CardHeader>
        <CardContent v-if="examEnabled" class="space-y-5">
            <!-- Time Limit -->
            <div class="space-y-2">
                <div class="flex items-center gap-2">
                    <Label for="exam-time-limit" class="cursor-pointer">Time Limit</Label>
                    <div class="flex-1" />
                    <input id="exam-time-limit" v-model="examTimeLimitEnabled" type="checkbox"
                        class="h-4 w-4 rounded border-border accent-primary" />
                </div>
                <div v-if="examTimeLimitEnabled" class="flex items-center gap-2">
                    <Input v-model.number="examTimeLimitMinutes" type="number" min="1" max="300"
                        class="w-24 h-8 text-sm" />
                    <span class="text-sm text-muted-foreground">minutes</span>
                </div>
            </div>

            <!-- Submit and Lock -->
            <div class="flex items-center gap-2">
                <div>
                    <Label for="exam-submit-lock" class="cursor-pointer">Submit and Lock</Label>
                    <p class="text-xs text-muted-foreground mt-0.5">
                        Show a submit button; locks the editor on submission.
                    </p>
                </div>
                <div class="flex-1" />
                <input id="exam-submit-lock" v-model="examSubmitAndLock" type="checkbox"
                    class="h-4 w-4 rounded border-border accent-primary" />
            </div>

            <!-- AI Tutor Access -->
            <div class="space-y-1.5">
                <Label for="exam-ai-mode">AI Tutor Access</Label>
                <select id="exam-ai-mode" v-model="examAiChatMode"
                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="enabled">Full tutoring chat</option>
                    <option value="restricted">Hints only (no free chat)</option>
                    <option value="disabled">No AI assistance</option>
                </select>
                <p class="text-xs text-muted-foreground">
                    <template v-if="examAiChatMode === 'enabled'">Students can ask the tutor questions
                        freely.</template>
                    <template v-else-if="examAiChatMode === 'restricted'">Students can only use the "Get Help" button;
                        free chat is disabled.</template>
                    <template v-else>All AI features are hidden and disabled.</template>
                </p>
            </div>
        </CardContent>
    </Card>
</template>
