import 'server-only';
import { readLines } from './protocol';

export interface Provider {
  complete(system: string, data: unknown, budget: number, signal: AbortSignal): Promise<string>;
  stream(system: string, data: unknown, budget: number, signal: AbortSignal): AsyncIterable<string>;
}

const geminiBase = 'https://generativelanguage.googleapis.com/v1beta/openai';
const messages = {
  configuration: 'Ninad AI’s model is being set up. Please try again later.',
  authentication: 'Ninad AI can’t connect to its model right now. Please try again later.',
  model: 'The configured chat model is unavailable. Please try again later.',
  quota: 'Ninad AI has reached its model usage limit. Please try again later.',
  network: 'Ninad AI couldn’t reach its model. Please try again in a moment.',
  response: 'The model returned an incomplete response. Please try again.',
  upstream: 'The model service is temporarily unavailable. Please try again in a moment.',
};

export class ProviderError extends Error {
  constructor(
    readonly kind: keyof typeof messages,
    readonly details: { step?: 'completion' | 'stream'; status?: number; finish?: 'length' | 'content_filter' | 'unexpected' } = {},
  ) {
    super(messages[kind]);
  }
}

export function createProvider(): Provider {
  const key = process.env.NINAD_AI_API_KEY?.trim();
  const model = process.env.NINAD_AI_MODEL?.trim();
  if (!key || !model) throw new ProviderError('configuration');
  let base: URL;
  try {
    base = new URL(process.env.NINAD_AI_BASE_URL?.trim() || (model.startsWith('gemini-') ? geminiBase : 'https://api.openai.com/v1'));
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

  async function request(system: string, data: unknown, budget: number, signal: AbortSignal, step: 'completion' | 'stream') {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST', cache: 'no-store', redirect: 'error', signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, stream: step === 'stream', max_tokens: reasoningEffort === 'minimal' ? Math.max(128, budget) : budget,
          temperature: 0, reasoning_effort: reasoningEffort,
          messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(data) }],
        }),
      });
    } catch {
      signal.throwIfAborted();
      throw new ProviderError('network', { step });
    }
    if (response.ok) return response;
    void response.body?.cancel().catch(() => {});
    const { status } = response;
    const kind = status === 429 ? 'quota'
      : status === 401 || status === 403 ? 'authentication'
      : status === 404 ? 'model'
      : status === 400 ? 'configuration' : 'upstream';
    throw new ProviderError(kind, { step, status });
  }

  return {
    async complete(system, data, budget, signal) {
      const response = await request(system, data, budget, signal, 'completion');
      const result = await response.json().catch(() => null);
      const content: unknown = result?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim() || content.length > 1200) {
        throw new ProviderError('response', { step: 'completion' });
      }
      return content.trim();
    },
    async *stream(system, data, budget, signal) {
      const response = await request(system, data, budget, signal, 'stream');
      const failure = new ProviderError('response', { step: 'stream' });
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw failure;
      let finished = false;
      let hasContent = false;
      try {
        for await (const line of readLines(response.body)) {
          if (!line.startsWith('data:')) continue;
          const event = line.slice(5).trim();
          if (!event) continue;
          if (event === '[DONE]') { finished = true; break; }
          const parsed = JSON.parse(event);
          const choice = parsed?.choices?.[0];
          if (parsed?.error) throw failure;
          if (choice?.finish_reason && choice.finish_reason !== 'stop') {
            const reason = choice.finish_reason;
            throw new ProviderError('response', {
              step: 'stream', finish: reason === 'length' || reason === 'content_filter' ? reason : 'unexpected',
            });
          }
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
        throw failure;
      }
      if (!finished || !hasContent) throw failure;
    },
  };
}
