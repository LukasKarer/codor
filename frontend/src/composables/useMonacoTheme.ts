import { ref, computed } from 'vue'
import { useMutationObserver } from '@vueuse/core'

export function useMonacoTheme() {
  const isDark = ref(document.documentElement.classList.contains('dark'))

  useMutationObserver(
    document.documentElement,
    () => { isDark.value = document.documentElement.classList.contains('dark') },
    { attributes: true, attributeFilter: ['class'] },
  )

  return computed(() => isDark.value ? 'vs-dark' : 'vs')
}
