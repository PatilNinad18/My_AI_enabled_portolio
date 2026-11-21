import styles from '@/styles/portfolio.module.scss';

export default function PageIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <header className={styles.intro}>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}
