import type { Metadata } from 'next';
import Link from 'next/link';
import NinadChat from '@/components/assistant/NinadChat';
import styles from '@/styles/assistant.module.scss';

export const metadata: Metadata = { title: 'Ninad AI' };

export default function AssistantPage() {
  return (
    <div className={styles.stage} data-assistant-page>
      <Link href="/" className={styles.back}>
        <span aria-hidden="true">←</span> Back to the portfolio
      </Link>
      <NinadChat />
    </div>
  );
}
