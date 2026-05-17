import type { LanguageRuntime, SupportedLanguage } from './types'
import { javascriptRuntime } from './javascript'
import { pythonRuntime } from './python'
import { javaRuntime } from './java'

const registry: Record<SupportedLanguage, LanguageRuntime> = {
  javascript: javascriptRuntime,
  python: pythonRuntime,
  java: javaRuntime,
}

export function getRuntime(language: SupportedLanguage): LanguageRuntime {
  return registry[language]
}

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value === 'javascript' || value === 'python' || value === 'java'
}

export function getAllLanguages(): LanguageRuntime[] {
  return Object.values(registry)
}
