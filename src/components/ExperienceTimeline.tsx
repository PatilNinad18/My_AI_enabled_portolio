import { experience } from '@/content/profile';
import styles from '@/styles/experience.module.scss';

export default function ExperienceTimeline() {
  return (
    <section className={styles.section} aria-labelledby="home-experience">
      <h2 id="home-experience" className={styles.title} data-heading-reveal>Professional Experience<span>.</span></h2>
      <div className={styles.timeline} data-timeline>
        <span className={styles.track} aria-hidden="true" />
        <span className={styles.progress} data-progress aria-hidden="true" />
        <ol role="list">
          {experience.map(({ organization, role, date, description }) => (
            <li key={organization} data-experience-card>
              <article className={styles.card}>
                <div className={styles.heading}>
                  <div>
                    <h3>{role}</h3>
                    <p className={styles.company}>{organization}</p>
                  </div>
                  <p className={styles.date}>{date}</p>
                </div>
                <p className={styles.description}>{description}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
