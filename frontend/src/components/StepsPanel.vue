<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Steps are intentionally not loaded on client side anymore.
</script>

<template>
  <div class="h-full overflow-auto p-4">
    <Card class="h-full border-0 shadow-none">
      <CardHeader class="px-0 pt-0">
        <CardTitle class="flex items-center gap-2">
          <CheckCircle2 class="h-5 w-5 text-primary" />
          Learning Steps
        </CardTitle>
        <CardDescription>
          Step details are evaluated server-side and not exposed in the client.
        </CardDescription>
      </CardHeader>
      <CardContent class="px-0">
        <p class="text-sm text-muted-foreground">
          Use chat or "Get Help" for guidance.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
