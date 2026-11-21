import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/styles/assistant.module.scss';

export const metadata: Metadata = { title: 'Ninad AI' };

export default function AssistantPage() {
  return (
    <div className={styles.stage}>
      <div className={styles.field} aria-hidden="true" />
      <section className={styles.terminal} aria-labelledby="assistant-title">
        <p className={styles.status}>Offline</p>
        <h1 id="assistant-title">Ninad AI</h1>
        <p>An AI guide to Ninad Patil’s portfolio.</p>
        <p>Conversation and voice will be available once the portfolio knowledge base is connected.</p>
        <Link href="/">Back to the portfolio</Link>
      </section>
    </div>
  );
}
