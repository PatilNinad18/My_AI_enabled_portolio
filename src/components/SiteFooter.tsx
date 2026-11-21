'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '@/styles/contactFooter.module.scss';

const linkedIn = 'https://www.linkedin.com/in/ninadpatil18/';
const github = 'https://github.com/PatilNinad18';

export default function SiteFooter() {
  const pathname = usePathname();

  if (pathname !== '/') {
    return (
      <footer className="footer">
        <Link href="/" prefetch={false}>Ninad Patil</Link>
        <span>Full-Stack &amp; AI Engineer</span>
        <Link href="/#contact" prefetch={false}>Contact</Link>
      </footer>
    );
  }

  return (
    <footer id="contact" className={styles.footer} aria-labelledby="contact-title" tabIndex={-1}>
      <div className={styles.invitation}>
        <h2 id="contact-title" className={styles.title}>
          <span data-contact-line>Something great</span>
          <span data-contact-line>starts with <em>a hello.</em></span>
        </h2>
        <a className={styles.cta} href={linkedIn} target="_blank" rel="noopener noreferrer">
          Let’s connect <span aria-hidden="true">↗</span>
        </a>
        <p className={styles.copy}>Whether it&apos;s full-stack development, AI engineering, interesting projects, or new opportunities, I&apos;d love to connect.</p>
      </div>
      <div className={styles.details}>
        <Link href="/" prefetch={false} className={styles.wordmark}>Ninad Patil<span>.</span></Link>
        <ul className={styles.links} aria-label="Contact links">
          <li><a href={linkedIn} target="_blank" rel="noopener noreferrer">LinkedIn <span aria-hidden="true">↗</span></a></li>
          <li><a href={github} target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a></li>
          <li><a href="tel:+918605221851">+91 8605221851</a></li>
        </ul>
        <a className={styles.top} href="#top" aria-label="Back to top">↑</a>
      </div>
      <p className={styles.copyright}>© 2026 Ninad Patil</p>
    </footer>
  );
}
