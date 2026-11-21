import 'server-only';
import { readLines } from './protocol';

export type TokenUsage = { input: number | null; output: number | null; total: number | null };
export interface Provider {
  stream(system: string, data: unknown, budget: number, signal: AbortSignal): AsyncIterable<string>;
}
type Observer = { call: (inputChars: number) => void; usage: (usage: TokenUsage) => void };

const geminiBase = 'https://generativelanguage.googleapis.com/v1beta/openai';
const kinds = ['configuration', 'authentication', 'model', 'quota', 'network', 'response', 'upstream'] as const;
type ErrorKind = (typeof kinds)[number];

export class ProviderError extends Error {
  constructor(readonly kind: ErrorKind, readonly status?: number, readonly retryMs?: number) {
    super(kind);
  }
}

function retryHeader(value: string | null) {
  if (!value) return undefined;
  const milliseconds = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now();
  return Number.isSafeInteger(milliseconds) && milliseconds > 0 ? milliseconds : undefined;
}

async function failure(response: Response) {
  const status = response.status;
  const kind = status === 429 ? 'quota'
    : status === 401 || status === 403 ? 'authentication'
    : status === 404 ? 'model' : status === 400 ? 'configuration' : 'upstream';
  let retryMs = retryHeader(response.headers.get('retry-after'));
  if (status === 429 || status === 503) {
    const body = await response.json().catch(() => null);
    const entries = Array.isArray(body) ? body : [body];
    for (const entry of entries) {
      if (!Array.isArray(entry?.error?.details)) continue;
      for (const detail of entry.error.details) {
        if (detail?.['@type'] !== 'type.googleapis.com/google.rpc.RetryInfo' || typeof detail.retryDelay !== 'string') continue;
        const delay = /^(\d+(?:\.\d+)?)s$/.exec(detail.retryDelay);
        const ms = delay ? Math.ceil(Number(delay[1]) * 1000) : 0;
        if (Number.isSafeInteger(ms) && ms > 0) retryMs = Math.max(retryMs ?? 0, ms);
      }
    }
  } else {
    void response.body?.cancel().catch(() => {});
  }
  return new ProviderError(kind, status, retryMs);
}

const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

export function createProvider(observer: Observer): Provider {
  const key = process.env.NINAD_AI_API_KEY?.trim();
  const model = process.env.NINAD_AI_MODEL?.trim();
  if (!key || !model) throw new ProviderError('configuration');
  let base: URL;
  try {
    base = new URL(process.env.NINAD_AI_BASE_URL?.trim() || geminiBase);
  } catch {
    throw new ProviderError('configuration');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) || base.username || base.password || base.search || base.hash) {
    throw new ProviderError('configuration');
  }
  const url = `${base.href.replace(/\/$/, '')}/chat/completions`;
  const gemini = base.hostname === 'generativelanguage.googleapis.com';
  const reasoningEffort = gemini && model.startsWith('gemini-3') ? 'minimal'
    : gemini && /^gemini-2\.5-flash(?:-|$)/.test(model) ? 'none' : undefined;

  return {
    async *stream(system, data, budget, signal) {
      const content = JSON.stringify(data);
      let response: Response;
      signal.throwIfAborted();
      observer.call(system.length + content.length);
      try {
        response = await fetch(url, {
          method: 'POST', cache: 'no-store', redirect: 'error', signal,
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, stream: true, stream_options: { include_usage: true }, max_tokens: budget,
            temperature: 0, reasoning_effort: reasoningEffort,
            messages: [{ role: 'system', content: system }, { role: 'user', content }],
          }),
        });
      } catch {
        signal.throwIfAborted();
        throw new ProviderError('network');
      }
      if (!response.ok) throw await failure(response);
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new ProviderError('response');
      let finished = false;
      let hasContent = false;
      try {
        for await (const line of readLines(response.body)) {
          if (!line.startsWith('data:')) continue;
          const event = line.slice(5).trim();
          if (!event) continue;
          if (event === '[DONE]') { finished = true; break; }
          const parsed = JSON.parse(event);
          if (parsed?.usage) observer.usage({
            input: count(parsed.usage.prompt_tokens),
            output: count(parsed.usage.completion_tokens),
            total: count(parsed.usage.total_tokens),
          });
          if (parsed?.error) throw new ProviderError(parsed.error.status === 'RESOURCE_EXHAUSTED' || parsed.error.code === 429 ? 'quota' : 'upstream');
          const choice = parsed?.choices?.[0];
          if (choice?.finish_reason && choice.finish_reason !== 'stop') throw new ProviderError('response');
          const chunk: unknown = choice?.delta?.content;
          if (typeof chunk === 'string' && chunk.length) {
            hasContent = true;
            yield chunk;
          }
          if (choice?.finish_reason === 'stop') finished = true;
        }
      } catch (error) {
        signal.throwIfAborted();
        if (error instanceof ProviderError) throw error;
        throw new ProviderError('response');
      }
      if (!finished || !hasContent) throw new ProviderError('response');
    },
  };
}
