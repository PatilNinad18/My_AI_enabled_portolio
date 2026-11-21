'use client';

import { useEffect } from 'react';

export default function AboutMotion({ region }: { region: 'intro' | 'story' }) {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(region === 'intro' ? '[data-about-intro]' : '[data-story-page]');
    const preference = window.matchMedia('(prefers-reduced-motion: no-preference)');
    if (!page || !preference.matches) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add('(prefers-reduced-motion: no-preference)', () => {
          if (region === 'intro') {
            gsap.timeline({ scrollTrigger: { trigger: page, start: 'top 85%', once: true } })
              .from('[data-about-reveal]', { opacity: .62, y: 13, duration: .72, stagger: .075, ease: 'power2.out' }, 0);
            return;
          }
          for (const chapter of page.querySelectorAll('[data-story-chapter]')) {
            const heading = chapter.querySelector('[data-chapter-heading]');
            const rule = chapter.querySelector('[data-chapter-rule]');
            const timeline = gsap.timeline({
              scrollTrigger: { trigger: chapter, start: 'top 86%', once: true },
            });
            timeline.from(rule, { scaleX: .3, duration: .7, ease: 'power2.out' }, 0)
              .from(heading, { y: 16, opacity: .58, duration: .65, ease: 'power2.out' }, 0);
          }
        }, page);
        cleanup = () => media.revert();
      }).catch(() => {
        // Content remains visible without animation.
      });

    return () => { disposed = true; cleanup?.(); };
  }, [region]);

  return null;
}
