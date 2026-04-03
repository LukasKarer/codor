import OpenAI from 'openai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

function getOpenRouterConfig(): OpenRouterConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  };
}

function getHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {};

  const referer = process.env.OPENROUTER_SITE_URL;
  if (referer) headers['HTTP-Referer'] = referer;

  const appName = process.env.OPENROUTER_APP_NAME;
  if (appName) headers['X-Title'] = appName;

  return headers;
}

export async function openRouterChatCompletion(payload: Record<string, unknown>) {
  const { apiKey, model } = getOpenRouterConfig();

  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: getHeaders(apiKey),
  });

  const completion = await client.chat.completions.create({
    model,
    ...(payload as any),
  });

  return completion as unknown as Record<string, unknown>;
}

export async function streamOpenRouterChatCompletion(
  payload: Record<string, unknown>,
  handlers: {
    onText: (text: string) => void;
    onFunctionCall: (name: string, args: Record<string, unknown>) => void;
  },
) {
  const { apiKey, model } = getOpenRouterConfig();

  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: getHeaders(apiKey),
  });

  const stream = (await client.chat.completions.create({
    model,
    stream: true,
    ...(payload as any),
  } as any)) as unknown as AsyncIterable<any>;

  const toolCalls = new Map<number, { name: string; argsText: string; emitted: boolean }>();

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;

    if (typeof delta?.content === 'string' && delta.content.length > 0) {
      handlers.onText(delta.content);
    }

    if (!Array.isArray(delta?.tool_calls)) continue;

    for (const call of delta.tool_calls) {
      const index = Number(call?.index ?? 0);
      const existing = toolCalls.get(index) ?? { name: '', argsText: '', emitted: false };
      if (typeof call?.function?.name === 'string') existing.name = call.function.name;
      if (typeof call?.function?.arguments === 'string') existing.argsText += call.function.arguments;

      if (!existing.emitted && existing.name && existing.argsText) {
        try {
          const args = JSON.parse(existing.argsText) as Record<string, unknown>;
          handlers.onFunctionCall(existing.name, args);
          existing.emitted = true;
        } catch {
          // Arguments are frequently streamed as partial JSON; wait for next chunks.
        }
      }

      toolCalls.set(index, existing);
    }
  }

  for (const call of toolCalls.values()) {
    if (call.emitted || !call.name || !call.argsText) continue;
    try {
      handlers.onFunctionCall(call.name, JSON.parse(call.argsText) as Record<string, unknown>);
    } catch {
      // Ignore unparseable tool calls.
    }
  }
}
