import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';

const router = Router();

function getAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey: key });
}

// ─── Tool declarations (mirrored from frontend) ────────────────────────────

const highlightCodeTool = {
  name: 'highlight_code',
  description: "Highlights a specific portion of code in the editor to draw the user's attention while explaining.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      start_line:   { type: Type.INTEGER, description: 'Starting line number (1-indexed).' },
      start_column: { type: Type.INTEGER, description: 'Starting column number (1-indexed). Optional.' },
      end_line:     { type: Type.INTEGER, description: 'Ending line number (1-indexed).' },
      end_column:   { type: Type.INTEGER, description: 'Ending column number (1-indexed). Optional.' },
    },
    required: ['start_line', 'end_line'],
  },
};

const generateTasksTool = {
  name: 'generate_tasks',
  description: 'Generates a list of educational tasks/steps based on the code.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        description: 'The list of tasks.',
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'Description of the task.' },
            lineStart:   { type: Type.INTEGER, description: 'Start line number.' },
            lineEnd:     { type: Type.INTEGER, description: 'End line number.' },
          },
          required: ['description', 'lineStart', 'lineEnd'],
        },
      },
    },
    required: ['tasks'],
  },
};

const generateDescriptionTool = {
  name: 'generate_description',
  description: 'Generates a comprehensive project description based on the code.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING, description: 'The generated project description.' },
    },
    required: ['description'],
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

// ─── Streaming chat ─────────────────────────────────────────────────────────

/**
 * POST /v1/ai/chat
 * Body: { messages: Message[], currentCode: string }
 * SSE events: text, function_call, done, error
 */
router.post('/ai/chat', async (req: Request, res: Response) => {
  const { messages, currentCode } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    currentCode: string;
  };

  initSSE(res);

  try {
    const ai = getAI();

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Prepend system turn
    contents.push({
      role: 'user',
      parts: [{ text: `${SYSTEM_PROMPT}\n\nCurrent code in the editor:\n\`\`\`javascript\n${currentCode}\n\`\`\`` }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'I understand. I will help you learn programming by explaining concepts clearly and using the highlight_code tool to show specific parts of the code when discussing them.' }],
    });

    for (const msg of messages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents,
      config: {
        tools: [{ functionDeclarations: [highlightCodeTool] }],
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        sendSSE(res, 'text', { text: chunk.text });
      }
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        for (const call of chunk.functionCalls) {
          if (call.name && call.args) {
            sendSSE(res, 'function_call', { name: call.name, args: call.args });
          }
        }
      }
    }

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
  const { step, code, exerciseDescription } = req.body as {
    step: { description: string; lineStart: number; lineEnd: number };
    code: string;
    exerciseDescription: string;
  };

  initSSE(res);

  try {
    const ai = getAI();

    const prompt = `You are a friendly programming tutor. A student is working on this exercise:

"${exerciseDescription}"

Here is the student's current code:
\`\`\`javascript
${code}
\`\`\`

The student clicked on this learning step to understand it better:
"${step.description}" (lines ${step.lineStart}–${step.lineEnd})

Your job is to:
1. IMMEDIATELY call the highlight_code tool to highlight lines ${step.lineStart} to ${step.lineEnd}
2. Explain this step clearly and concisely — what the code at those lines does and why it matters
3. Do NOT give away solutions or write code for the student
4. Keep the explanation brief (2-4 sentences)

Start by calling highlight_code, then give your explanation.`;

    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [highlightCodeTool] }],
        temperature: 0.7,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) sendSSE(res, 'text', { text: chunk.text });
      if (chunk.functionCalls) {
        for (const call of chunk.functionCalls) {
          sendSSE(res, 'function_call', { name: call.name, args: call.args });
        }
      }
    }

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
  const { code, exerciseDescription, tasksOutline } = req.body as {
    code: string;
    exerciseDescription: string;
    tasksOutline: Array<{ description: string; lineStart: number; lineEnd: number }>;
  };

  initSSE(res);

  try {
    const ai = getAI();

    const tasksContext = tasksOutline
      .map((task, idx) => `${idx + 1}. ${task.description} (Lines ${task.lineStart}-${task.lineEnd})`)
      .join('\n');

    const prompt = `You are a helpful programming tutor. A student is working on this exercise:

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

    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [highlightCodeTool] }],
        temperature: 0.8,
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) sendSSE(res, 'text', { text: chunk.text });
      if (chunk.functionCalls) {
        for (const call of chunk.functionCalls) {
          sendSSE(res, 'function_call', { name: call.name, args: call.args });
        }
      }
    }

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
    const ai = getAI();

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

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [generateTasksTool] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['generate_tasks'],
          },
        },
      },
    });

    const calls = result.functionCalls;
    if (calls && calls.length > 0 && calls[0].name === 'generate_tasks') {
      res.json({ tasks: (calls[0].args as { tasks: unknown[] }).tasks });
    } else {
      res.json({ tasks: [] });
    }
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
    const ai = getAI();

    const prompt = `You are an expert programming tutor.
Your goal is to generate a comprehensive and educational description for the provided code.
The description should explain what the code does. Do NOT include implementation details or step-by-step instructions.

Code:
${code}

Use the \`generate_description\` tool to return the result.
`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [generateDescriptionTool] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['generate_description'],
          },
        },
      },
    });

    const calls = result.functionCalls;
    if (calls && calls.length > 0 && calls[0].name === 'generate_description') {
      res.json({ description: (calls[0].args as { description: string }).description });
    } else {
      res.json({ description: '' });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
