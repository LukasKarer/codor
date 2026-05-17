export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface LanguageRuntime {
  id: string
  name: string
  monacoLanguage: string
  defaultCode: string
  isReady: boolean
  initialize(): Promise<void>
  run(code: string): Promise<RunResult>
}

export type SupportedLanguage = 'javascript' | 'python' | 'java'

export const LANGUAGE_META: Record<
  SupportedLanguage,
  { name: string; monacoLanguage: string; extension: string }
> = {
  javascript: { name: 'JavaScript', monacoLanguage: 'javascript', extension: 'js' },
  python: { name: 'Python', monacoLanguage: 'python', extension: 'py' },
  java: { name: 'Java', monacoLanguage: 'java', extension: 'java' },
}
