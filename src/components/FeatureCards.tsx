import type { Feature, FeatureIcon } from '@/content/home';
import styles from '@/styles/homeSections.module.scss';

const icons: Record<FeatureIcon, string> = {
  layers: 'm12 3 9 4.5-9 4.5-9-4.5L12 3ZM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5',
  server: 'M5 4h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 9h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2ZM7 7.5h.01M7 16.5h.01m4-9h6m-6 9h6',
  sparkles: 'm12 2 2.45 6.55L21 11l-6.55 2.45L12 20l-2.45-6.55L3 11l6.55-2.45L12 2Zm7 13v6m-3-3h6',
  vision: 'M8 4H4v4m12-4h4v4m0 8v4h-4m-8 0H4v-4m2-4s2.3-3.5 6-3.5 6 3.5 6 3.5-2.3 3.5-6 3.5S6 12 6 12Zm6 0h.01',
  database: 'M19.5 6.5c0 1.7-3.4 3-7.5 3s-7.5-1.3-7.5-3 3.4-3 7.5-3 7.5 1.3 7.5 3Zm0 0v11c0 1.7-3.4 3-7.5 3s-7.5-1.3-7.5-3v-11m15 5.5c0 1.7-3.4 3-7.5 3s-7.5-1.3-7.5-3',
  terminal: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 5 3 3-3 3m6 0h4',
};

export function LineIcon({ name }: { name: FeatureIcon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

type FeatureCardsProps = {
  id: string;
  title: string;
  items: readonly Feature[];
};

export default function FeatureCards({ id, title, items }: FeatureCardsProps) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <h2 id={`${id}-title`} data-heading-reveal>{title}<span>.</span></h2>
      </div>
      <ul className={styles.cards} role="list" data-feature-grid>
        {items.map(({ title: cardTitle, description, icon }) => (
          <li key={cardTitle} className={styles.cardFrame} data-feature-card>
            <article className={styles.card}>
              <div className={styles.icon} data-feature-icon><LineIcon name={icon} /></div>
              <h3>{cardTitle}</h3>
              <p>{description}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
