export const questionLimit = 600;
export const historyLimit = 4;
export const outsideScope = "I'm Ninad AI, a portfolio assistant. I can help you explore Ninad's projects, skills, experience, and engineering journey.";
export const insufficientEvidence = "I don't have enough verified information about that in Ninad's portfolio.";

export type Citation = { title: string; href?: string };
export const citationKey = ({ title, href }: Citation) => href ?? title;
export type ConversationTurn = { question: string; answer?: string };
export type ChatEvent =
  | { type: 'chunk'; text: string; sources: Citation[] }
  | { type: 'error'; message: string }
  | { type: 'done' };

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
