'use client';

import { useEffect } from 'react';

export default function HomeAnchors() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('[data-hero-sequence]');
    const stage = document.querySelector<HTMLElement>('[data-globe-transition]');
    if (!hero || !stage) return;

    let previousHero = hero.getBoundingClientRect().height;
    let previousStage = stage.getBoundingClientRect().height;
    const observer = new ResizeObserver(() => {
      const heroHeight = hero.getBoundingClientRect().height;
      const stageHeight = stage.getBoundingClientRect().height;
      const hash = window.location.hash;
      const belowStage = hash === '#projects' || hash === '#contact';
      const change = heroHeight - previousHero + (belowStage ? stageHeight - previousStage : 0);
      previousHero = heroHeight;
      previousStage = stageHeight;
      if (!change || (hash !== '#about' && !belowStage)) return;
      const destination = document.getElementById(hash.slice(1));
      if (!destination) return;

      // Pin spacing can change after a fragment navigation.
      // Correct only if the reader was still at the fragment before that shift.
      const beforeShift = destination.getBoundingClientRect().top - change;
      const anchorOffset = Number.parseFloat(getComputedStyle(destination).scrollMarginTop);
      if (Math.abs(beforeShift - anchorOffset) < 5) destination.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    observer.observe(hero);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  return null;
}
