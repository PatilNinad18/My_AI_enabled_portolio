import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { profile } from '@/content/profile';
import styles from '@/styles/hero.module.scss';

const portrait = '/images/ninad-hero-portrait.png';

export default function PortraitHero() {
  const hasPortrait = existsSync(join(process.cwd(), 'public', portrait));

  return (
    <div id="home" className={styles.sequence} data-hero-sequence tabIndex={-1}>
    <section className={styles.hero} data-hero aria-labelledby="hero-title">
      <div className={styles.annotations}>
        <span>Engineering portfolio</span>
        <span>Full-Stack × AI</span>
      </div>
      <div className={styles.stage} data-portrait-stage>
        <div className={styles.photoFrame} data-portrait-frame>
        {hasPortrait && (
          <Image className={styles.photo} data-portrait-image src={portrait}
            alt="Black-and-white portrait of Ninad Patil" fill
            sizes="(max-width: 700px) 100vw, 700px" preload />
        )}
        </div>
        {!hasPortrait && <p className={styles.missing}>Portrait pending</p>}
      </div>
      <div className={styles.copy}>
        <h1 id="hero-title">Ninad Patil<span>.</span></h1>
        <div className={styles.intro}>
          <p className={styles.role} data-hero-line>{profile.role}</p>
          <p className={styles.tagline} data-hero-line>I build software that thinks.</p>
          <p className={styles.description} data-hero-line>{profile.focus}</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/work">Explore My Work</Link>
            <a className={styles.secondary} href="/assistant" target="_blank" rel="noopener noreferrer">
              Talk to My AI <span className={styles.srOnly}>(opens in a new tab)</span>
            </a>
          </div>
        </div>
      </div>
      <a className={styles.scroll} href="#about"><span data-scroll-line aria-hidden="true" />Scroll to About</a>
    </section>
    </div>
  );
}
