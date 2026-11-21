import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { preload } from 'react-dom';
import Link from 'next/link';
import { profile } from '@/content/profile';
import styles from '@/styles/hero.module.scss';

const portrait = '/images/ninad-hero-portrait.webp';
const portraitSources = `/images/ninad-hero-portrait-320.webp 320w, ${portrait} 585w`;
const portraitSizes = '(max-width: 700px) min(100vw, 421px), min(70svh, 585px)';

export default function PortraitHero() {
  const hasPortrait = existsSync(join(process.cwd(), 'public', portrait));
  if (hasPortrait) preload(portrait, { as: 'image', imageSrcSet: portraitSources, imageSizes: portraitSizes, fetchPriority: 'high' });

  return (
    <div id="home" className={styles.sequence} data-hero-sequence tabIndex={-1}>
    <section className={styles.hero} data-hero aria-labelledby="hero-title">
      <div className={styles.annotations}>
        <span>Engineering portfolio</span>
        <span>· SOFTWARE × AI</span>
      </div>
      <div className={styles.stage} data-portrait-stage>
        <div className={styles.photoFrame} data-portrait-frame>
        {hasPortrait && (
          // The art is pre-encoded at its useful display sizes, so it needs no cold optimizer request.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.photo} data-portrait-image src={portrait} srcSet={portraitSources} sizes={portraitSizes}
            alt="Black-and-white portrait of Ninad Patil" width={585} height={489} decoding="async" fetchPriority="high" />
        )}
        </div>
        {!hasPortrait && <p className={styles.missing}>Portrait pending</p>}
      </div>
      <div className={styles.copy}>
        <h1 id="hero-title">Ninad Patil<span>.</span></h1>
        <div className={styles.intro}>
          <p className={styles.role} data-hero-line>{profile.role}</p>
          <p className={styles.tagline} data-hero-line>I build software that solves real problems.</p>
          <p className={styles.description} data-hero-line>{profile.focus}</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/work" prefetch={false}>Explore My Work</Link>
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
