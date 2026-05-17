import type { LanguageRuntime, RunResult } from './types'

let teavmCompiler: any = null
let teavmLoad: any = null

const PROXY_BASE = import.meta.env.DEV
  ? '/proxy/teavm/'
  : `${import.meta.env.VITE_API_BASE_URL}/v1/proxy/teavm/`

const COMPILER_WASM_URL = `${PROXY_BASE}compiler.wasm`
const RUNTIME_JS_URL = `${PROXY_BASE}compiler.wasm-runtime.js`
const SDK_URL = `${PROXY_BASE}compile-classlib-teavm.bin`
const CLASSLIB_URL = `${PROXY_BASE}runtime-classlib-teavm.bin`

export const javaRuntime: LanguageRuntime = {
  id: 'java',
  name: 'Java',
  monacoLanguage: 'java',
  defaultCode: `public class Main {
    public static String greet(String name) {
        String greeting = "Hello, " + name + "!";
        System.out.println(greeting);
        return greeting;
    }

    public static void main(String[] args) {
        String result = greet("Student");
        System.out.println(result);
    }
}`,
  isReady: false,

  async initialize() {
    if (teavmCompiler) return

    const mod = await import(/* @vite-ignore */ RUNTIME_JS_URL)
    teavmLoad = mod.load

    const teavm = await teavmLoad(COMPILER_WASM_URL, {
      stackDeobfuscator: { enabled: true },
    })

    const compilerLib = teavm.exports
    const compiler = compilerLib.createCompiler()

    const [sdkRes, runtimeRes] = await Promise.all([
      fetch(SDK_URL),
      fetch(CLASSLIB_URL),
    ])

    compiler.setSdk(new Int8Array(await sdkRes.arrayBuffer()))
    compiler.setTeaVMClasslib(new Int8Array(await runtimeRes.arrayBuffer()))

    teavmCompiler = compiler
    javaRuntime.isReady = true
  },

  async run(code: string): Promise<RunResult> {
    if (!teavmCompiler) {
      await javaRuntime.initialize()
    }

    let stdout = ''
    let stderr = ''

    teavmCompiler.clearSourceFiles()
    teavmCompiler.clearOutputFiles()

    // Extract class name from source code
    const classNameMatch =
      code.match(/public\s+class\s+(\w+)/) || code.match(/class\s+(\w+)/)
    const className = classNameMatch ? classNameMatch[1] : 'Main'
    const fileName = `${className}.java`

    teavmCompiler.addSourceFile(fileName, code)

    const diagReg = teavmCompiler.onDiagnostic((diag: any) => {
      const msg = `[${diag.type}] ${diag.severity}: ${diag.fileName}:${diag.lineNumber} ${diag.message}`
      if (diag.severity === 'error') {
        stderr += msg + '\n'
      }
    })

    try {
      const compileSuccess = teavmCompiler.compile()
      if (!compileSuccess) {
        return { stdout, stderr, exitCode: 1 }
      }

      const genSuccess = teavmCompiler.generateWebAssembly({
        outputName: 'app',
        mainClass: className,
      })

      if (!genSuccess) {
        return { stdout, stderr, exitCode: 1 }
      }

      const wasmBytes = teavmCompiler.getWebAssemblyOutputFile('app.wasm')
      if (!wasmBytes) {
        stderr += 'Failed to generate WebAssembly output\n'
        return { stdout, stderr, exitCode: 1 }
      }

      const runtime = await teavmLoad(wasmBytes, {
        installImports(o: any) {
          o.teavmConsole.putcharStdout = (ch: number) => {
            if (ch === 0x0a) {
              stdout += '\n'
            } else {
              stdout += String.fromCharCode(ch)
            }
          }
          o.teavmConsole.putcharStderr = (ch: number) => {
            if (ch === 0x0a) {
              stderr += '\n'
            } else {
              stderr += String.fromCharCode(ch)
            }
          }
        },
      })

      runtime.exports.main([])
      return { stdout, stderr, exitCode: 0 }
    } catch (e: any) {
      stderr += e.message + '\n'
      return { stdout, stderr, exitCode: 1 }
    } finally {
      diagReg.destroy()
    }
  },
}
