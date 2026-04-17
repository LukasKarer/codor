import { Router, Request, Response } from 'express';
import { openRouterChatCompletion, streamOpenRouterChatCompletion } from '../lib/openrouter';

const router = Router();

// ─── Tool declarations (mirrored from frontend) ────────────────────────────

const highlightCodeTool = {
  type: 'function' as const,
  function: {
    name: 'highlight_code',
    description: "Highlights a specific portion of code in the editor to draw the user's attention while explaining.",
    parameters: {
      type: 'object',
      properties: {
        start_line: { type: 'integer', description: 'Starting line number (1-indexed).' },
        start_column: { type: 'integer', description: 'Starting column number (1-indexed). Optional.' },
        end_line: { type: 'integer', description: 'Ending line number (1-indexed).' },
        end_column: { type: 'integer', description: 'Ending column number (1-indexed). Optional.' },
      },
      required: ['start_line', 'end_line'],
    },
  },
};

const generateTasksTool = {
  type: 'function' as const,
  function: {
    name: 'generate_tasks',
    description: 'Generates a list of educational tasks/steps based on the code.',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          description: 'The list of tasks.',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Description of the task.' },
              lineStart: { type: 'integer', description: 'Start line number.' },
              lineEnd: { type: 'integer', description: 'End line number.' },
            },
            required: ['description', 'lineStart', 'lineEnd'],
          },
        },
      },
      required: ['tasks'],
    },
  },
};

const generateDescriptionTool = {
  type: 'function' as const,
  function: {
    name: 'generate_description',
    description: 'Generates a comprehensive project description based on the code.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'The generated project description.' },
      },
      required: ['description'],
    },
  },
};

const SYSTEM_PROMPT = `You are a friendly and patient programming tutor helping students learn to code. Your goal is to:
- Explain programming concepts clearly and simply
- Use the highlight_code tool to visually show which parts of code you're referring to
- Encourage students and build their confidence
- Break down complex topics into digestible pieces
- Ask guiding questions to help students think through problems
- NEVER give the solution outright. Guide the student to the answer.
- If the student asks for the solution, politely refuse and offer a hint instead.

When explaining code, always use the highlight_code tool to show the specific lines you're discussing.`;

const LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
};

function languageInstruction(language: string | undefined): string {
  const name = LANGUAGE_NAMES[language ?? ''] ?? 'German';
  return `\n\nIMPORTANT: Always respond in ${name}.`;
}

// ─── SSE helpers ───────────────────────────────────────────────────────────

function initSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function extractToolCallArgs<T>(response: Record<string, unknown>, expectedToolName: string): T | null {
  const choices = response.choices as Array<Record<string, unknown>> | undefined;
  const first = choices?.[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const toolCalls = message?.tool_calls as Array<Record<string, unknown>> | undefined;

  if (!toolCalls || toolCalls.length === 0) return null;

  const call = toolCalls.find((tc) => {
    const fn = tc.function as Record<string, unknown> | undefined;
    return fn?.name === expectedToolName;
  });

  if (!call) return null;
  const fn = call.function as Record<string, unknown> | undefined;
  const argsText = fn?.arguments;
  if (typeof argsText !== 'string') return null;

  try {
    return JSON.parse(argsText) as T;
  } catch {
    return null;
  }
}

// ─── Streaming chat ─────────────────────────────────────────────────────────

/**
 * POST /v1/ai/chat
 * Body: { messages: Message[], currentCode: string }
 * SSE events: text, function_call, done, error
 */
router.post('/ai/chat', async (req: Request, res: Response) => {
  const { messages, currentCode, language } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    currentCode: string;
    language?: string;
  };

  initSSE(res);

  try {
    const chatMessages = [
      {
        role: 'system' as const,
        content: `${SYSTEM_PROMPT}${languageInstruction(language)}\n\nCurrent code in the editor:\n\`\`\`javascript\n${currentCode}\n\`\`\``,
      },
      ...messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    await streamOpenRouterChatCompletion(
      {
        messages: chatMessages,
        tools: [highlightCodeTool],
        temperature: 0.7,
        top_p: 0.95,
      },
      {
        onText: (text) => {
          sendSSE(res, 'text', { text });
        },
        onFunctionCall: (name, args) => {
          sendSSE(res, 'function_call', { name, args });
        },
      },
    );

    sendSSE(res, 'done', {});
    res.end();
  } catch (err) {
    sendSSE(res, 'error', { message: err instanceof Error ? err.message : 'Unknown error' });
    res.end();
  }
});

// ─── Explain step ───────────────────────────────────────────────────────────

/**
 * POST /v1/ai/explain-step
 * Body: { step: { description, lineStart, lineEnd }, code: string, exerciseDescription: string }
 * SSE events: text, function_call, done, error
 */
router.post('/ai/explain-step', async (req: Request, res: Response) => {
  const { step, code, exerciseDescription, language } = req.body as {
    step: { description: string; lineStart: number; lineEnd: number };
    code: string;
    exerciseDescription: string;
    language?: string;
  };

  initSSE(res);

  try {
    const prompt = `You are a friendly programming tutor. A student is working on this exercise:${languageInstruction(language)}

"${exerciseDescription}"

Here is the student's current code:
\`\`\`javascript
${code}
\`\`\`

The student clicked on this learning step to understand it better:
"${step.description}" (lines ${step.lineStart}-${step.lineEnd})

Your job is to:
1. IMMEDIATELY call the highlight_code tool to highlight lines ${step.lineStart} to ${step.lineEnd}
2. Explain this step clearly and concisely - what the code at those lines does and why it matters
3. Do NOT give away solutions or write code for the student
4. Keep the explanation brief (2-4 sentences)

Start by calling highlight_code, then give your explanation.`;

    await streamOpenRouterChatCompletion(
      {
        messages: [{ role: 'user', content: prompt }],
        tools: [highlightCodeTool],
        temperature: 0.7,
      },
      {
        onText: (text) => {
          sendSSE(res, 'text', { text });
        },
        onFunctionCall: (name, args) => {
          sendSSE(res, 'function_call', { name, args });
        },
      },
    );

    sendSSE(res, 'done', {});
    res.end();
  } catch (err) {
    sendSSE(res, 'error', { message: err instanceof Error ? err.message : 'Unknown error' });
    res.end();
  }
});

// ─── Get help ───────────────────────────────────────────────────────────────

/**
 * POST /v1/ai/get-help
 * Body: { code: string, exerciseDescription: string, tasksOutline: Step[] }
 * SSE events: text, function_call, done, error
 */
router.post('/ai/get-help', async (req: Request, res: Response) => {
  const { code, exerciseDescription, tasksOutline, language } = req.body as {
    code: string;
    exerciseDescription: string;
    tasksOutline: Array<{ description: string; lineStart: number; lineEnd: number }>;
    language?: string;
  };

  initSSE(res);

  try {
    const tasksContext = tasksOutline
      .map((task, idx) => `${idx + 1}. ${task.description} (Lines ${task.lineStart}-${task.lineEnd})`)
      .join('\n');

    const prompt = `You are a helpful programming tutor. A student is working on this exercise:${languageInstruction(language)}

"${exerciseDescription}"

Here is the student's current code:
\`\`\`javascript
${code}
\`\`\`

Internal context (DO NOT share these exact task descriptions with the student):
${tasksContext}

The student has clicked "Get Help". Your job is to:
1. Analyze their current code and compare it with what the exercise asks for
2. Provide helpful hints and guidance WITHOUT giving away the solution
3. Use highlight_code tool to point to specific sections
4. Ask guiding questions
5. NEVER write the actual solution code

Provide your guidance now:`;

    await streamOpenRouterChatCompletion(
      {
        messages: [{ role: 'user', content: prompt }],
        tools: [highlightCodeTool],
        temperature: 0.8,
      },
      {
        onText: (text) => {
          sendSSE(res, 'text', { text });
        },
        onFunctionCall: (name, args) => {
          sendSSE(res, 'function_call', { name, args });
        },
      },
    );

    sendSSE(res, 'done', {});
    res.end();
  } catch (err) {
    sendSSE(res, 'error', { message: err instanceof Error ? err.message : 'Unknown error' });
    res.end();
  }
});

// ─── Generate tasks (non-streaming, function-call forced) ──────────────────

/**
 * POST /v1/ai/generate-tasks
 * Body: { code: string, description: string }
 * Response: { tasks: Step[] }
 */
router.post('/ai/generate-tasks', async (req: Request, res: Response) => {
  const { code, description } = req.body as { code: string; description: string };

  try {
    const prompt = `You are an expert programming tutor.
Your goal is to break down the provided code into a series of high-level, educational tasks or steps that a student would follow to build this code.

For each task:
1. Provide a clear, concise description of what needs to be done.
2. Identify the specific lines of code (start and end) that correspond to this task.
3. Ensure the tasks are in logical order.
4. Use the \`generate_tasks\` tool to return the result.

Code:
${code}

Description:
${description}
`;

    const result = await openRouterChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      tools: [generateTasksTool],
      tool_choice: {
        type: 'function',
        function: { name: 'generate_tasks' },
      },
    });

    const args = extractToolCallArgs<{ tasks: unknown[] }>(result, 'generate_tasks');
    res.json({ tasks: args?.tasks ?? [] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── Generate description (non-streaming, function-call forced) ────────────

/**
 * POST /v1/ai/generate-description
 * Body: { code: string }
 * Response: { description: string }
 */
router.post('/ai/generate-description', async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };

  try {
    const prompt = `You are an expert programming tutor.
Your goal is to generate a comprehensive and educational description for the provided code.
The description should explain what the code does. Do NOT include implementation details or step-by-step instructions.

Code:
${code}

Use the \`generate_description\` tool to return the result.
`;

    const result = await openRouterChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      tools: [generateDescriptionTool],
      tool_choice: {
        type: 'function',
        function: { name: 'generate_description' },
      },
    });

    const args = extractToolCallArgs<{ description: string }>(result, 'generate_description');
    res.json({ description: args?.description ?? '' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
