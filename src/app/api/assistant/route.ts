import { randomUUID } from 'node:crypto';
import { answer } from '@/lib/assistant/answer';
import { InvalidRequest, readQuestion, reserve } from '@/lib/assistant/limits';
import type { ChatEvent } from '@/lib/assistant/protocol';
import { createProvider, ProviderError } from '@/lib/assistant/provider';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  const release = reserve(request);
  if (!release) return errorResponse('Too many requests. Please try again shortly.', 429, { 'Retry-After': '60' });
  const requestId = randomUUID();
  const cancelled = new AbortController();
  const timeout = AbortSignal.timeout(48_000);
  const disconnect = AbortSignal.any([request.signal, cancelled.signal]);
  const signal = AbortSignal.any([disconnect, timeout]);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: ChatEvent) => {
        if (!disconnect.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      void (async () => {
        try {
          await answer(input.question, input.history, createProvider, signal, emit);
        } catch (error) {
          if (disconnect.aborted) return;
          const failure = error instanceof ProviderError ? error : undefined;
          console.warn(`[ninad-ai] Response failed ${JSON.stringify({
            requestId, reason: timeout.aborted ? 'timeout' : failure?.kind ?? 'internal', ...failure?.details,
          })}`);
          emit({ type: 'error', message: timeout.aborted
            ? 'Ninad AI took too long to respond. Please try again.'
            : failure?.message ?? 'Ninad AI couldn’t finish the response. Please try again.' });
        } finally {
          release();
          if (!disconnect.aborted) {
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
    'X-Request-ID': requestId,
  } });
}
