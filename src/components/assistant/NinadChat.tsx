'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { citationKey, historyLimit, questionLimit, readLines, type ChatEvent, type Citation, type ConversationTurn } from '@/lib/assistant/protocol';
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

class ChatFailure extends Error {}

type Message = { id: string; role: 'user' | 'assistant'; text: string; sources: Citation[] };
const storageKey = 'ninad-ai-v1-conversation';
const messageLimit = 24;

function safeCitation(value: unknown): value is Citation {
  if (!value || typeof value !== 'object') return false;
  const { href, title } = value as Citation;
  return typeof title === 'string' && (href === undefined || (typeof href === 'string' && (/^\/(?![\\/])/.test(href) || /^https:\/\//.test(href))));
}

function restoreMessages(): Message[] {
  try {
    const history: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(history)) return [];
    return history.slice(-messageLimit).filter((message): message is Message =>
      message && typeof message.id === 'string' && ['user', 'assistant'].includes(message.role) &&
      typeof message.text === 'string' && message.text.length > 0 && message.text.length <= 3000 &&
      Array.isArray(message.sources) && message.sources.every(safeCitation),
    );
  } catch { return []; }
}

export default function NinadChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
    setNotice('Conversation cleared.');
    input.current?.focus();
  }

  async function send(value: string) {
    const question = value.trim();
    if (!restored || !question || question.length > questionLimit || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const replyId = crypto.randomUUID();
    const history = messages.flatMap<ConversationTurn>((message, index) => {
      const reply = messages[index + 1];
      if (message.role !== 'user' || reply?.role !== 'assistant' || !reply.sources.length) return [];
      return [{ question: message.text, answer: reply.text.slice(0, questionLimit) }];
    }).slice(-historyLimit);
    autoScroll.current = true;
    setAway(false);
    setDraft('');
    setError('');
    setNotice('');
    setBusy(true);
    setMessages((current) => {
      const last = current.at(-1);
      const turns = error && last?.role === 'user' && last.text === question
        ? current
        : [...current, { id: crypto.randomUUID(), role: 'user' as const, text: question, sources: [] }];
      return [...turns, { id: replyId, role: 'assistant' as const, text: '', sources: [] }].slice(-messageLimit);
    });

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }), signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new ChatFailure(typeof data.message === 'string' ? data.message : 'The chat is unavailable. Please try again.');
      }
      if (!response.body) throw new ChatFailure('No response was received. Please try again.');
      let done = false;
      for await (const line of readLines(response.body)) {
        if (controller.signal.aborted) return;
        const event = JSON.parse(line) as ChatEvent;
        if (event.type === 'error') setError(event.message);
        if (event.type === 'done') done = true;
        if (event.type === 'chunk') {
          setMessages((current) => current.map((message) => message.id === replyId ? {
            ...message,
            text: [message.text, event.text].filter(Boolean).join('\n\n'),
            sources: [...new Map([...message.sources, ...event.sources.filter(safeCitation)].map((source) => [citationKey(source), source])).values()],
          } : message));
        }
      }
      if (!done) throw new ChatFailure('The response was interrupted. Please try again.');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof ChatFailure
        ? failure.message : 'Could not reach the chat. Please try again.');
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
            const links = message.sources.filter((source) => source.href).slice(0, 3);
            const references = message.sources.filter((source) => !source.href).slice(0, 5);
            return (
              <article key={message.id} className={styles.message} data-role={message.role}>
                <p className={styles.author}>{message.role === 'user' ? 'You' : 'Ninad AI'}</p>
                {message.role === 'assistant' ? <MessageText text={message.text} /> : <div className={styles.userText}>{message.text}</div>}
                {links.length > 0 && (
                  <ul className={styles.sources} aria-label="Source links">
                    {links.map(({ href, title }) => (
                      <li key={href}><a href={href} target="_blank" rel="noopener noreferrer">{title} <span aria-hidden="true">↗</span></a></li>
                    ))}
                  </ul>
                )}
                {references.length > 0 && <p className={styles.references}>Source documents · {references.map(({ title }) => title).join(' · ')}</p>}
              </article>
            );
          })}
          {busy && <p className={styles.processing}><span className={styles.signal} aria-hidden="true" />{messages.at(-1)?.text ? 'Checking the rest of the answer…' : 'Finding relevant sources…'}</p>}
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
        {error && <p className={styles.error} role="alert">{error}</p>}
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
