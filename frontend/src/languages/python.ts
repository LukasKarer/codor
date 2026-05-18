import type { LanguageRuntime, RunResult } from './types'

let pyodideInstance: any = null

export const pythonRuntime: LanguageRuntime = {
  id: 'python',
  name: 'Python',
  monacoLanguage: 'python',
  defaultCode: `def greet(name):
    greeting = "Hello, " + name + "!"
    print(greeting)
    return greeting

result = greet("Student")
print(result)`,
  isReady: false,

  async initialize() {
    if (pyodideInstance) return

    const { loadPyodide } = await import(
      /* @vite-ignore */
      // @ts-expect-error URL import — resolved at runtime
      'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs'
    )

    pyodideInstance = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
    })

    pythonRuntime.isReady = true
  },

  async run(code: string): Promise<RunResult> {
    if (!pyodideInstance) {
      await pythonRuntime.initialize()
    }

    let stdout = ''
    let stderr = ''

    pyodideInstance.setStdout({
      batched: (text: string) => {
        stdout += text + '\n'
      },
    })
    pyodideInstance.setStderr({
      batched: (text: string) => {
        stderr += text + '\n'
      },
    })

    try {
      await pyodideInstance.runPythonAsync(code)
      return { stdout, stderr, exitCode: 0 }
    } catch (e: any) {
      stderr += e.message + '\n'
      return { stdout, stderr, exitCode: 1 }
    }
  },
}
