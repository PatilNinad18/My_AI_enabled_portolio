import { technologyRows } from '@/content/home';
import { LineIcon } from '@/components/FeatureCards';
import sectionStyles from '@/styles/homeSections.module.scss';
import styles from '@/styles/marquees.module.scss';

function TechnologyIcon({ icon }: { icon: (typeof technologyRows)[number]['tools'][number][1] }) {
  if (icon === 'sparkles') return <LineIcon name={icon} />;

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <use href={`/images/technology-icons.svg#${icon}`} />
    </svg>
  );
}

export default function TechnologyMarquees() {
  return (
    <section className={`${sectionStyles.section} ${styles.section}`} aria-labelledby="home-technologies">
      <div className={`${sectionStyles.heading} ${styles.heading}`}>
        <h2 id="home-technologies" data-heading-reveal>Tools, Technologies &amp; Frameworks<span>.</span></h2>
      </div>
      <div className={styles.rows}>
        {technologyRows.map(({ label, direction, tools }) => (
          <div key={label} className={styles.row} data-direction={direction} role="group" aria-label={label} tabIndex={0}>
            <div className={styles.track} data-marquee-track>
              {[false, true].map((duplicate) => (
                <ul key={String(duplicate)} className={styles.list} role="list" aria-hidden={duplicate || undefined}>
                  {tools.map(([name, icon]) => (
                    <li key={name} className={styles.badge}>
                      <TechnologyIcon icon={icon} />
                      {name}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
