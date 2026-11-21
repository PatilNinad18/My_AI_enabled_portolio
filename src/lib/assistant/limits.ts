import { historyLimit, questionLimit, type ConversationTurn } from './protocol';

export class InvalidRequest extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

const maxBytes = 24_576;
const windowMs = 60_000;
const clients = new Map<string, number>();
let reset = 0;
let total = 0;
let concurrent = 0;

export function reserve(request: Request) {
  const now = Date.now();
  if (now >= reset) {
    reset = now + windowMs;
    total = 0;
    clients.clear();
  }
  const header = process.env.NINAD_AI_CLIENT_IP_HEADER;
  const client = (header ? request.headers.get(header)?.split(',')[0].trim().slice(0, 64) : undefined) || 'shared';
  const used = clients.get(client) ?? 0;
  if (concurrent >= 3 || total >= 40 || used >= 12) return undefined;
  clients.set(client, used + 1);
  total++;
  concurrent++;
  return () => { concurrent--; };
}

function clean(value: unknown): string {
  if (typeof value !== 'string' || value.length > questionLimit) throw new InvalidRequest(`Questions must contain 1–${questionLimit} characters.`, 400);
  const text = value.normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > questionLimit || /\p{Cc}/u.test(text)) throw new InvalidRequest('Enter a valid question.', 400);
  return text;
}

export async function readQuestion(request: Request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  // Next.js can normalize its request URL behind a proxy. Browser fetch metadata
  // identifies cross-origin requests without depending on that internal URL.
  const host = request.headers.get('host') ?? new URL(request.url).host;
  const matchesHost = !origin || origin === `https://${host}` || origin === `http://${host}`;
  if (fetchSite === 'cross-site' || fetchSite === 'same-site' || (fetchSite !== 'same-origin' && !matchesHost)) {
    throw new InvalidRequest('This endpoint accepts requests from the portfolio.', 403);
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new InvalidRequest('Expected JSON.', 415);
  if (!request.body) throw new InvalidRequest('A question is required.', 400);
  if (Number(request.headers.get('content-length')) > maxBytes) throw new InvalidRequest('The request is too large.', 413);

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let json = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new InvalidRequest('The request is too large.', 413);
      }
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  let data: unknown;
  try { data = JSON.parse(json); } catch { throw new InvalidRequest('Invalid JSON.', 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InvalidRequest('Invalid question payload.', 400);
  const { question, history = [] } = data as { question?: unknown; history?: unknown };
  if (!Array.isArray(history) || history.length > historyLimit) throw new InvalidRequest('Too much conversation history.', 400);
  const turns: ConversationTurn[] = history.map((turn: unknown) => {
    if (typeof turn === 'string') return { question: clean(turn) };
    if (!turn || typeof turn !== 'object' || Array.isArray(turn) || !('question' in turn)) {
      throw new InvalidRequest('Invalid conversation turn.', 400);
    }
    return { question: clean(turn.question), answer: 'answer' in turn ? clean(turn.answer) : undefined };
  });
  return { question: clean(question), history: turns };
}
