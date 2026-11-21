export const questionLimit = 600;
export const historyLimit = 4;
export const contextLimit = 2;
export const outsideScope = "I'm Ninad AI, a portfolio assistant. I can help you explore Ninad's projects, skills, experience, and engineering journey.";
export const insufficientEvidence = "I don't have enough verified information about that in Ninad's portfolio.";

export type Citation = { title: string; href?: string };
export type PublicLink = Citation & { href: string };
export const citationKey = ({ title, href }: Citation) => href ?? title;
export type ConversationTurn = { question: string; answer?: string };
export type ChatEvent =
  | { type: 'chunk'; text: string; sources: Citation[] }
  | { type: 'notice'; message: string; retryAfter?: number }
  | { type: 'error'; message: string }
  | { type: 'done' };
export type ChatStreamEvent = Exclude<ChatEvent, { type: 'chunk' }>
  | { type: 'chunk'; text: string; grounded: boolean; links: PublicLink[] };

export function isPublicLink(value: unknown): value is PublicLink {
  if (!value || typeof value !== 'object') return false;
  const { title, href } = value as Citation;
  return typeof title === 'string' && typeof href === 'string' && !/[\s\\]/.test(href)
    && (/^\/(?!\/)/.test(href) || /^https:\/\/[^/]/i.test(href));
}

export function presentChatEvent(event: ChatEvent): ChatStreamEvent {
  if (event.type !== 'chunk') return event;
  const links = event.sources.filter(isPublicLink).map(({ title, href }) => ({
    title: title.replace(/ · GitHub$/, ' on GitHub').replace(/ · website$/, ' website'),
    href,
  }));
  return { type: 'chunk', text: event.text, grounded: event.sources.length > 0, links };
}

export async function* readLines(body: ReadableStream<Uint8Array>, maxLength = 16_000) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffer.indexOf('\n')) !== -1) {
        if (end > maxLength) throw new Error('Stream line exceeds its limit');
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (line) yield line;
      }
      if (buffer.length > maxLength) throw new Error('Stream line exceeds its limit');
      if (done) {
        finished = true;
        if (buffer.trim()) yield buffer.trim();
        break;
      }
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
