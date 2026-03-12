# Style Guidelines — Vue Frontend (`frontend-vue`)

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Vue 3 (Composition API) |
| Language | TypeScript — all files use `<script setup lang="ts">` |
| Styling | Tailwind CSS v4 (CSS-first config via `@theme inline` in `style.css`) |
| UI Components | shadcn-vue (new-york style, neutral base color, CSS variables) |
| State | Pinia (`src/stores/app.ts`) |
| Routing | Vue Router (`src/router/index.ts`) |
| Icons | `lucide-vue-next` |
| Toasts | `vue-sonner` — call `toast()` / `toast.success()` / `toast.error()` directly (no hook needed) |
| Monaco Editor | `@guolao/vue-monaco-editor` — use `<VueMonacoEditor>` component |
| AI | `@google/genai` via `src/lib/ai.ts` |
| API | `src/lib/api.ts` |

---

## Component Authoring Rules

- **Always** use `<script setup lang="ts">` — never Options API or class components.
- One component per file. File names use **PascalCase** (e.g., `ChatWindow.vue`).
- Pages live in `src/pages/`, reusable components in `src/components/`.
- UI primitives (button, card, input…) come exclusively from `src/components/ui/` (shadcn-vue).
- **Never hand-write** shadcn UI components. Install them with:
  ```
  npx shadcn-vue@latest add <component>
  ```

---

## Tailwind v4 Specifics

- There is **no** `tailwind.config.ts`. All theme tokens are defined in `src/style.css` under `@theme inline { … }`.
- Color values use **oklch()** (not hsl). Example: `oklch(0.5 0.15 270)`.
- Custom CSS variables added to the theme:
  - `--color-code-bg`, `--color-code-line-number`, `--color-code-string` — Monaco editor
  - `--color-chat-tutor` — chat bubble tint
- Custom utilities defined directly in `style.css`:
  - `scrollbar-thin` — thin OS-native scrollbar
  - `animate-gradient` — animated gradient border keyframes

---

## State Management (Pinia)

- Single store: `useAppStore` from `src/stores/app.ts`.
- Store state is accessed and mutated **directly** (`store.code = '...'`). Do not wrap mutations in actions unless sharing logic across multiple components.
- Types `Message`, `Step`, and `CodeHighlight` are defined in `src/lib/ai.ts` and re-exported from the store for convenience.

---

## Vue Patterns (React → Vue Equivalents)

| React | Vue |
|---|---|
| `useState` | `ref()` / `reactive()` |
| `useEffect` | `watch()` / `watchEffect()` / `onMounted()` |
| `useMemo` / `useCallback` | `computed()` |
| Context API | Pinia store |
| React Router `useNavigate` | `useRouter()` → `router.push()` |
| React Router `useSearchParams` | `useRoute()` → `route.query` |
| React Router `useLocation` | `useRoute()` → `route.path` |
| `useToast` (shadcn) | `toast()` from `vue-sonner` |
| `onClick` | `@click` |
| `onChange` | `@input` or `v-model` |
| `onKeyDown` | `@keydown` |
| `className` | `class` |
| `{condition && <Comp />}` | `v-if="condition"` |
| `array.map(item => <Item />)` | `v-for="item in array" :key="…"` |
| `<>…</>` (Fragment) | Native multi-root templates (Vue 3 supports these) |

---

## Routing

Routes are defined in `src/router/index.ts`:

| Path | Page component |
|---|---|
| `/` | `IndexPage.vue` (student view) |
| `/teacher` | `TeacherDashboard.vue` |
| `/teacher/upload` | `TeacherUpload.vue` |
| `/teacher/progress` | `StudentProgress.vue` |
| `/:pathMatch(.*)*` | `NotFound.vue` |

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_GEMINI_API_KEY` | Google Gemini API key used by `src/lib/ai.ts` |

Create a `.env` file in `frontend-vue/` with the same key as the React app's `.env`.

---

## File Structure Overview

```
frontend-vue/src/
├── App.vue                  # Root — <RouterView> + <Toaster>
├── main.ts                  # Vite entry; registers Vue, Pinia, Router
├── style.css                # Tailwind v4 CSS-first theme + custom utilities
├── router/
│   └── index.ts
├── stores/
│   └── app.ts               # Pinia store (single store for all shared state)
├── lib/
│   ├── ai.ts                # Gemini AI helpers + shared types (Message, Step, CodeHighlight)
│   ├── api.ts               # REST API client
│   └── utils.ts             # shadcn-vue cn() utility
├── workers/
│   └── codeExecutor.ts      # Web Worker for sandboxed JS execution
├── components/
│   ├── ThemeToggle.vue
│   ├── CodeEditor.vue       # Monaco editor + step highlights
│   ├── ChatWindow.vue       # Streaming AI chat + exercise description
│   ├── StepsPanel.vue       # Step list with hover-to-highlight
│   └── ui/                  # shadcn-vue primitives (do not edit manually)
└── pages/
    ├── IndexPage.vue        # Student view: loading → setup → resizable editor+chat
    ├── TeacherDashboard.vue
    ├── TeacherUpload.vue    # Code editor + AI description/task generation + publish
    ├── StudentProgress.vue  # Three-column: exercises → students → detail
    └── NotFound.vue
```
