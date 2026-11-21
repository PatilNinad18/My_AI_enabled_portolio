import type { Metadata } from 'next';
import PageIntro from '@/components/PageIntro';
import ProjectGrid from '@/components/ProjectGrid';
import styles from '@/styles/portfolio.module.scss';

export const metadata: Metadata = { title: 'Work' };

export default function WorkPage() {
  return (
    <div className={styles.shell}>
      <PageIntro title="Selected work.">Projects in full-stack engineering and AI/ML.</PageIntro>
      <div className={styles.inner}><ProjectGrid /></div>
    </div>
  );
}
