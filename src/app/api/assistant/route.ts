import { randomUUID } from 'node:crypto';
import { answer, type AnswerResult } from '@/lib/assistant/answer';
import { InvalidRequest, isLocalRequest, readQuestion, visitorId, visitorWindow } from '@/lib/assistant/limits';
import { presentChatEvent, type ChatEvent } from '@/lib/assistant/protocol';
import { createProvider, type TokenUsage } from '@/lib/assistant/provider';
import { forwardToPython } from '@/lib/assistant/python-backend';
import { getAssistantStore, storageKey, type AssistantStore } from '@/lib/assistant/store';

export const runtime = 'nodejs';
export const maxDuration = 30;

const cache = { 'Cache-Control': 'no-store' };
const errorResponse = (message: string, status: number, headers = {}) =>
  Response.json({ message }, { status, headers: { ...cache, ...headers } });

export async function POST(request: Request) {
  let input: Awaited<ReturnType<typeof readQuestion>>;
  try {
    input = await readQuestion(request);
  } catch (error) {
    return error instanceof InvalidRequest
      ? errorResponse(error.message, error.status)
      : errorResponse('Could not read the question.', 400);
  }

  if (process.env.NINAD_AI_BACKEND !== 'legacy') {
    try {
      return await forwardToPython(request, input, visitorId(request, isLocalRequest(request)));
    } catch {
      console.warn('[ninad-ai] backend=fastapi source=proxy-error reason=visitor-identity');
      return errorResponse('The assistant is temporarily unavailable. Please try again shortly.', 503, { 'Retry-After': '30' });
    }
  }

  const requestId = randomUUID();
  const started = Date.now();
  let geminiCalls = 0;
  let promptCharacters: number | undefined;
  let tokenUsage: TokenUsage | undefined;
  function log(outcome: string, fields: { reason?: string; retryAfter?: number; upstreamStatus?: number } = {}) {
    console.info('[ninad-ai]', JSON.stringify({
      requestId, backend: 'legacy', outcome, geminiCalls, promptCharacters,
      tokenUsage: tokenUsage ?? null, durationMs: Date.now() - started, ...fields,
    }));
  }

  let store: AssistantStore;
  try {
    const loopback = isLocalRequest(request);
    const visitor = visitorId(request, loopback);
    store = getAssistantStore(loopback);
    const { retryMs } = await store.take(storageKey(`visitor:${visitor}`), visitorWindow, Date.now());
    if (retryMs > 0) {
      const retryAfter = Math.ceil(retryMs / 1000);
      const minutes = Math.ceil(retryAfter / 60);
      log('rate-limit', { retryAfter });
      return errorResponse(`You’ve reached the limit of 15 questions per hour. Try again in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`, 429, {
        'Retry-After': String(retryAfter), 'X-Request-ID': requestId,
      });
    }
  } catch {
    log('storage-unavailable');
    return errorResponse('The assistant is temporarily unavailable. Please try again shortly.', 503, { 'Retry-After': '30', 'X-Request-ID': requestId });
  }

  const cancelled = new AbortController();
  const disconnect = AbortSignal.any([request.signal, cancelled.signal]);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: ChatEvent) => {
        if (!disconnect.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(presentChatEvent(event))}\n`));
      };
      void (async () => {
        let result: AnswerResult | undefined;
        try {
          result = await answer(input.question, input.history, () => createProvider({
            call: (size) => { geminiCalls++; promptCharacters = size; },
            usage: (usage) => { tokenUsage = usage; },
          }), disconnect, emit, store);
        } catch {
          if (!disconnect.aborted) emit({ type: 'error', message: 'The assistant couldn’t finish the response. Please try again.' });
        } finally {
          if (disconnect.aborted) log('cancelled');
          else {
            if (result) log(result.outcome, { reason: result.reason, retryAfter: result.retryAfter, upstreamStatus: result.upstreamStatus });
            else log('internal-error');
            emit({ type: 'done' });
            controller.close();
          }
        }
      })();
    },
    cancel() { cancelled.abort(); },
  });
  return new Response(body, { headers: {
    ...cache, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no',
    'X-Request-ID': requestId, 'X-Ninad-Backend': 'legacy',
  } });
}
