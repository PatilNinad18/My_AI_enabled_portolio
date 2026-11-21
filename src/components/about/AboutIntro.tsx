import Link from 'next/link';
import DisciplineSelector from '@/components/about/DisciplineSelector';
import ParticleGlobe from '@/components/about/ParticleGlobe';
import styles from '@/styles/about.module.scss';

export default function AboutIntro() {
  return (
    <section id="about" className={`${styles.page} ${styles.masthead}`} data-about-intro aria-labelledby="about-intro" tabIndex={-1}>
      <div className={styles.eyebrow}>
        <h2 id="about-intro" className={styles.annotation}>Three disciplines. One perspective.</h2>
        <p className={styles.annotation}>Chapters 01–04</p>
      </div>
      <div data-globe-transition>
        <div className={styles.intro} data-globe-pin>
          <ParticleGlobe />
          <div className={styles.identity}>
            <blockquote className={styles.quote} data-about-reveal>
              The good job of a developer is to make the complex <em>appear simple</em>
            </blockquote>
            <p className={styles.identityLead} data-about-reveal>Engineer by education. Builder by curiosity.</p>
            <p className={styles.identitySub} data-about-reveal>Exploring AI, software engineering, and turning ideas into products.</p>
            <Link className={styles.storyLink} href="/story" data-about-reveal>Read my story <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </div>
      <DisciplineSelector />
    </section>
  );
}
