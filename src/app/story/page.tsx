import type { Metadata } from 'next';
import AboutMotion from '@/components/about/AboutMotion';
import ChapterIndex from '@/components/about/ChapterIndex';
import { chapters } from '@/content/about';
import styles from '@/styles/about.module.scss';

export const metadata: Metadata = {
  title: 'My Story',
  description: 'The story of Ninad Patil across software engineering, applied AI, independent products, and engineering education.',
};

const chapterLinks = chapters.map(({ id, number, title }) => ({ id, number, title }));

export default function StoryPage() {
  return (
    <div className={styles.page} data-story-page>
      <AboutMotion region="story" />
      <h1 className={styles.srOnly}>The story of Ninad Patil</h1>
      <div className={styles.story}>
        <ChapterIndex links={chapterLinks} />
        <div className={styles.narrative}>
          {chapters.map(({ id, number, title, content }) => (
            <section key={id} id={id} className={styles.chapter} data-story-chapter aria-labelledby={`${id}-title`}>
              <span className={styles.chapterRule} data-chapter-rule aria-hidden="true" />
              <header data-chapter-heading>
                <p className={`${styles.annotation} ${styles.chapterNumber}`}>Chapter {number}</p>
                <h2 id={`${id}-title`}>{title}</h2>
              </header>
              <div className={styles.body}>{content}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
