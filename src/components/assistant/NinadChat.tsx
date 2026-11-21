'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { contextLimit, isPublicLink, questionLimit, readLines, type ChatStreamEvent, type ConversationTurn, type PublicLink } from '@/lib/assistant/protocol';
import RobotScene from './RobotScene';
import MessageText from './MessageText';
import styles from '@/styles/assistant.module.scss';

const suggestions = [
  ['About Ninad', 'Who is Ninad Patil?'],
  ['Projects', 'What projects has Ninad built?'],
  ['AI & LLMs', 'What is his experience with AI and LLMs?'],
  ['Internships', 'What is his internship experience?'],
  ['Coding experience', 'Is he good at coding?'],
] as const;

class ChatFailure extends Error {
  constructor(message: string, readonly retryAfter = 0) { super(message); }
}

type Message = { id: string; role: 'user' | 'assistant'; text: string; links: PublicLink[]; grounded?: boolean };
type Retry = { question: string; turnId: string; readyAt: number };
const storageKey = 'ninad-ai-v1-conversation';
const messageLimit = 24;

function restoreMessages(): Message[] {
  try {
    const history: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(history)) return [];
    return history.slice(-messageLimit).flatMap((message): Message[] => {
      if (!message || typeof message.id !== 'string' || !['user', 'assistant'].includes(message.role)
        || typeof message.text !== 'string' || !message.text.trim() || message.text.length > 4000) return [];
      const legacySources: unknown[] = Array.isArray(message.sources) ? message.sources : [];
      const links: unknown[] = Array.isArray(message.links) ? message.links : legacySources;
      return [{
        id: message.id, role: message.role, text: message.text,
        links: links.filter(isPublicLink).slice(0, 3),
        grounded: message.grounded === true || legacySources.some((source) =>
          source && typeof source === 'object' && 'title' in source && typeof source.title === 'string'),
      }];
    });
  } catch { return []; }
}

export default function NinadChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<Retry | null>(null);
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);
  const [away, setAway] = useState(false);
  const active = messages.length > 0;
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { setMessages(restoreMessages()); setRestored(true); });
    return () => { cancelAnimationFrame(frame); request.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(messages.filter(({ text }) => text))); } catch { /* Optional storage. */ }
  }, [messages, restored]);

  useEffect(() => {
    if (!active) return;
    const onScroll = () => {
      if (!end.current || !dock.current) return;
      const distance = end.current.getBoundingClientRect().bottom + dock.current.offsetHeight - window.innerHeight;
      autoScroll.current = distance < 100;
      setAway(!autoScroll.current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [active]);

  function scrollToLatest() {
    if (!end.current || !dock.current) return;
    const bottom = end.current.getBoundingClientRect().bottom + window.scrollY + dock.current.offsetHeight;
    window.scrollTo({ top: Math.max(0, bottom - window.innerHeight), behavior: 'instant' });
  }

  useEffect(() => {
    if (!active || !autoScroll.current) return;
    const frame = requestAnimationFrame(scrollToLatest);
    return () => cancelAnimationFrame(frame);
  }, [active, messages, busy, error]);

  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = 'auto';
    input.current.style.height = `${input.current.scrollHeight}px`;
  }, [draft, active]);

  useEffect(() => {
    if (!retry?.readyAt) return;
    const delay = retry.readyAt - Date.now();
    if (delay > 2_147_483_647) return;
    const timer = setTimeout(() => {
      setRetry((current) => current === retry ? { ...current, readyAt: 0 } : current);
    }, Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [retry]);

  function cancel() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setMessages((current) => current.filter(({ text }) => text));
  }

  function clear() {
    cancel();
    autoScroll.current = true;
    setAway(false);
    setMessages([]);
    setDraft('');
    setError('');
    setRetry(null);
    setNotice('Conversation cleared.');
    input.current?.focus();
  }

  async function send(value: string, retrying?: Retry) {
    const question = value.trim();
    if (!restored || !question || question.length > questionLimit || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const replyId = crypto.randomUUID();
    const turnId = retrying?.turnId ?? crypto.randomUUID();
    const prior = retrying ? messages.findIndex(({ id }) => id === turnId) : -1;
    const earlier = prior >= 0 ? messages.slice(0, prior) : messages;
    const history = earlier.flatMap<ConversationTurn>((message, index) => {
      const reply = earlier[index + 1];
      if (message.role !== 'user' || reply?.role !== 'assistant' || !reply.grounded) return [];
      return [{ question: message.text, answer: reply.text.slice(0, questionLimit) }];
    }).slice(-contextLimit);
    autoScroll.current = true;
    setAway(false);
    setDraft('');
    setError('');
    setRetry(null);
    setNotice('');
    setBusy(true);
    const turns: Message[] = [...earlier, { id: turnId, role: 'user', text: question, links: [] },
      { id: replyId, role: 'assistant', text: '', links: [] }];
    setMessages(turns.slice(-messageLimit));

    function showRetry(message: string, retryAfter = 0) {
      const readyAt = Number.isFinite(retryAfter) && retryAfter > 0 ? Date.now() + retryAfter * 1000 : 0;
      setError(message);
      setRetry({ question, turnId, readyAt });
    }

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }), signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new ChatFailure(typeof data.message === 'string' ? data.message : 'The chat is unavailable. Please try again.',
          Number(response.headers.get('Retry-After')));
      }
      if (!response.body) throw new ChatFailure('No response was received. Please try again.');
      let done = false;
      for await (const line of readLines(response.body)) {
        if (controller.signal.aborted) return;
        const event = JSON.parse(line) as ChatStreamEvent;
        if (event.type === 'error') showRetry(event.message);
        if (event.type === 'notice') {
          const minutes = event.retryAfter && Math.ceil(event.retryAfter / 60);
          const wait = minutes ? ` You can retry in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` : '';
          showRetry(event.message + wait, event.retryAfter);
        }
        if (event.type === 'done') done = true;
        if (event.type === 'chunk') {
          setMessages((current) => current.map((message) => message.id === replyId ? {
            ...message,
            text: [message.text, event.text].filter(Boolean).join('\n\n'),
            grounded: message.grounded || event.grounded,
            links: [...new Map([...message.links, ...event.links.filter(isPublicLink)].map((link) => [link.href, link])).values()].slice(0, 3),
          } : message));
        }
      }
      if (!done) throw new ChatFailure('The response was interrupted. Please try again.');
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof ChatFailure) showRetry(failure.message, failure.retryAfter);
        else showRetry('Could not reach the chat. Please try again.');
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
        setMessages((current) => current.filter(({ text }) => text));
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(draft); }
  function enter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  }

  return (
    <section className={styles.chat} data-active={active || undefined} aria-labelledby="assistant-title">
      {active ? (
        <header className={styles.compact}>
          <span className={styles.companion} aria-hidden="true" />
          <h1 id="assistant-title">Ninad AI</h1>
          <button type="button" className={styles.textButton} onClick={clear}>Clear conversation</button>
        </header>
      ) : (
        <div className={styles.welcome}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}><span className={styles.signal} aria-hidden="true" /> Portfolio assistant</p>
            <h1 id="assistant-title">Meet <em>Ninad AI.</em></h1>
            <p>Ask me about Ninad’s projects, skills, internships, or engineering journey.</p>
          </header>
          <RobotScene />
        </div>
      )}

      {active && (
        <div className={styles.log} role="log" aria-label="Conversation" tabIndex={0}>
          {messages.map((message) => {
            if (!message.text) return null;
            return (
              <article key={message.id} className={styles.message} data-role={message.role}>
                <p className={styles.author}>{message.role === 'user' ? 'You' : 'Ninad AI'}</p>
                {message.role === 'assistant' ? <MessageText text={message.text} /> : <div className={styles.userText}>{message.text}</div>}
                {message.links.length > 0 && (
                  <ul className={styles.sources} aria-label="Related links">
                    {message.links.map(({ href, title }) => (
                      <li key={href}><a href={href} target="_blank" rel="noopener noreferrer">{title} <span aria-hidden="true">↗</span></a></li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
          {busy && <p className={styles.processing}><span className={styles.signal} aria-hidden="true" />{messages.at(-1)?.text ? 'Finishing up…' : 'Thinking…'}</p>}
          <div ref={end} />
        </div>
      )}

      <div className={styles.dock} ref={dock}>
        {active && away && (
          <button type="button" className={styles.latest} onClick={() => {
            autoScroll.current = true;
            setAway(false);
            scrollToLatest();
          }}>Jump to latest <span aria-hidden="true">↓</span></button>
        )}
        {error && (
          <div className={styles.error}>
            <p role="status">{error}</p>
            {retry && <button className={styles.textButton} type="button" disabled={busy || Boolean(retry.readyAt)}
              onClick={() => void send(retry.question, retry)}>{retry.readyAt ? 'Retry later' : 'Retry'}</button>}
          </div>
        )}
        <p className={styles.srOnly} role="status">{notice}</p>
        <form className={styles.composer} onSubmit={submit}>
          <label className={styles.srOnly} htmlFor="assistant-question">Ask Ninad AI</label>
          <textarea ref={input} id="assistant-question" rows={1} value={draft} maxLength={questionLimit}
            placeholder="Ask a question about Ninad…" onChange={(event) => setDraft(event.target.value)} onKeyDown={enter} />
          {busy ? (
            <button type="button" onClick={() => { cancel(); setNotice('Generation stopped.'); input.current?.focus(); }}>Stop</button>
          ) : (
            <button type="submit" disabled={!restored || !draft.trim()}>Send <span aria-hidden="true">↑</span></button>
          )}
        </form>
        {!active && (
          <div className={styles.suggestions} role="group" aria-label="Suggested questions">
            {suggestions.map(([label, question]) => (
              <button type="button" key={question} disabled={!restored} onClick={() => void send(question)}>
                {label} <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
