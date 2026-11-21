'use client';

import { useEffect, useState } from 'react';
import styles from '@/styles/about.module.scss';

type ChapterLink = { id: string; number: string; title: string };

export default function ChapterIndex({ links }: { links: readonly ChapterLink[] }) {
  const [active, setActive] = useState(links[0]?.id);
  useEffect(() => {
    const chapters = links.map(({ id }) => document.getElementById(id)).filter((item) => item !== null);
    const header = document.querySelector('[data-site-header]');
    let observer: IntersectionObserver | undefined;

    const observe = () => {
      observer?.disconnect();
      const boundary = Math.min(window.innerHeight - 2, (header?.getBoundingClientRect().height ?? 0) + 105);
      const inBand = new Set<Element>();
      const update = () => {
        const current = chapters.findLast((chapter) => inBand.has(chapter))
          ?? chapters.findLast((chapter) => chapter.getBoundingClientRect().top <= boundary)
          ?? chapters[0];
        if (current) setActive(current.id);
      };
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target);
          else inBand.delete(entry.target);
        }
        update();
      }, {
        rootMargin: `-${boundary}px 0px -${window.innerHeight - boundary - 2}px 0px`,
      });
      chapters.forEach((chapter) => observer?.observe(chapter));
      update();
    };

    observe();
    const geometry = new ResizeObserver(observe);
    if (header) geometry.observe(header);
    window.addEventListener('resize', observe);
    return () => {
      observer?.disconnect();
      geometry.disconnect();
      window.removeEventListener('resize', observe);
    };
  }, [links]);

  return (
    <nav className={styles.index} aria-label="Story chapters">
      <p className={styles.annotation}>In this chapter</p>
      <ol role="list">
        {links.map(({ id, number, title }) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={active === id ? 'location' : undefined}>
              <span>{number}</span>{title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
