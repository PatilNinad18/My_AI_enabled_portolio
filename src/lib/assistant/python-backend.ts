import 'server-only';
import { isPublicLink, type ChatStreamEvent, type ConversationTurn, readLines } from './protocol';

function unavailable(reason: string) {
  console.warn('[ninad-ai] backend=fastapi source=proxy-error reason=%s', reason);
  return Response.json({ message: 'The assistant is temporarily unavailable. Please try again shortly.' }, {
    status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' },
  });
}

function publicEvent(value: unknown): ChatStreamEvent {
  if (!value || typeof value !== 'object' || !('type' in value)) throw new Error('Invalid upstream message');
  if (value.type === 'done') return { type: 'done' };
  if (value.type === 'chunk' && 'text' in value && typeof value.text === 'string') {
    const links = 'links' in value && Array.isArray(value.links) ? value.links.filter(isPublicLink) : [];
    return { type: 'chunk', text: value.text, grounded: 'grounded' in value && value.grounded === true,
      links: links.map(({ title, href }) => ({ title, href })) };
  }
  if ('message' in value && typeof value.message === 'string') {
    if (value.type === 'error') return { type: 'error', message: value.message };
    if (value.type === 'notice') {
      const retryAfter = 'retryAfter' in value && typeof value.retryAfter === 'number' ? value.retryAfter : undefined;
      return { type: 'notice', message: value.message, retryAfter };
    }
  }
  throw new Error('Invalid upstream message');
}

export async function forwardToPython(request: Request, input: { question: string; history: ConversationTurn[] }, visitor: string) {
  const token = process.env.NINAD_AI_BACKEND_TOKEN;
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(27000)]);
  try {
    const url = new URL(process.env.NINAD_AI_BACKEND_URL?.trim() || 'http://127.0.0.1:8000');
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (!token || !/^[\x21-\x7e]{32,}$/.test(token) || url.username || url.password || url.search || url.hash
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) return unavailable('configuration');
    const response = await fetch(url.href.replace(/\/$/, '') + '/chat', {
      method: 'POST', cache: 'no-store', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Ninad-Visitor': visitor },
      body: JSON.stringify(input),
    });
    if (response.headers.get('X-Ninad-Backend') !== 'fastapi') {
      await response.body?.cancel();
      return unavailable('unexpected-backend');
    }
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Ninad-Backend': 'fastapi' });
    const id = response.headers.get('X-Request-ID');
    if (id) headers.set('X-Request-ID', id);
    const retry = response.headers.get('Retry-After');
    if (retry && /^\d+$/.test(retry)) headers.set('Retry-After', retry);
    if (!response.ok) {
      if ([400, 403, 413, 415, 429, 503].includes(response.status)) {
        const data = await response.json();
        if (typeof data?.message !== 'string') return unavailable('invalid-error');
        return Response.json({ message: data.message }, { status: response.status, headers });
      }
      await response.body?.cancel();
      return unavailable(`upstream-http-${response.status}`);
    }
    if (!response.body || !response.headers.get('Content-Type')?.startsWith('text/event-stream')) {
      await response.body?.cancel();
      return unavailable('invalid-stream');
    }
    const lines = readLines(response.body);
    const encoder = new TextEncoder();
    let done = false;
    headers.set('Content-Type', 'application/x-ndjson; charset=utf-8');
    headers.set('X-Accel-Buffering', 'no');
    return new Response(new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          for (;;) {
            const result = await lines.next();
            if (result.done) {
              if (!done) throw new Error('Incomplete upstream response');
              output.close();
              return;
            }
            // The Python endpoint sends one JSON data line per SSE event.
            if (!result.value.startsWith('data:')) continue;
            const event = publicEvent(JSON.parse(result.value.slice(5)));
            done = event.type === 'done';
            output.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
            return;
          }
        } catch {
          if (request.signal.aborted || controller.signal.aborted) return;
          controller.abort();
          output.enqueue(encoder.encode('{"type":"error","message":"The assistant stream was interrupted. Please retry."}\n{"type":"done"}\n'));
          output.close();
          await lines.return(undefined).catch(() => {});
        }
      },
      async cancel() {
        controller.abort();
        await lines.return(undefined).catch(() => {});
      },
    }), { headers });
  } catch {
    controller.abort();
    return unavailable('connection');
  }
}
