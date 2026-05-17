import type { LanguageRuntime, RunResult } from './types'

export const javascriptRuntime: LanguageRuntime = {
  id: 'javascript',
  name: 'JavaScript',
  monacoLanguage: 'javascript',
  defaultCode: `function greet(name) {
  const greeting = "Hello, " + name + "!";
  console.log(greeting);
  return greeting;
}

const result = greet("Student");
console.log(result);`,
  isReady: true,

  initialize() {
    return Promise.resolve()
  },

  run(code: string): Promise<RunResult> {
    return new Promise((resolve) => {
      const worker = new Worker(
        new URL('../workers/codeExecutor.ts', import.meta.url),
        { type: 'module' },
      )

      let stdout = ''
      let stderr = ''
      let resolved = false

      const finish = (exitCode: number) => {
        if (resolved) return
        resolved = true
        worker.terminate()
        resolve({ stdout, stderr, exitCode })
      }

      worker.onmessage = (e) => {
        const { type, level, args, message } = e.data
        if (type === 'console') {
          stdout += args.join(' ') + '\n'
        } else if (type === 'error') {
          stderr += message + '\n'
        } else if (type === 'system' && e.data.status === 'finished') {
          finish(0)
        }
      }

      worker.onerror = (err) => {
        stderr += `Worker Error: ${err.message}\n`
        finish(1)
      }

      worker.postMessage(code)

      // Safety timeout
      setTimeout(() => finish(stderr ? 1 : 0), 30000)
    })
  },
}
