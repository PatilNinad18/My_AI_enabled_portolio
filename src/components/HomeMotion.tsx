'use client';

import { useEffect } from 'react';

type Journey = Awaited<ReturnType<typeof import('@/lib/homeParticles')['mountHomeParticles']>>;
const ease = 'cubic-bezier(.22, .7, .2, 1)';

function sectionReveals(root: HTMLElement) {
  const active = new Map<Element, Animation>();
  const repeat = '[data-heading-reveal], #contact-title';
  const tracks = root.querySelectorAll('[data-marquee-track]');
  const marqueeVisibility = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) target.setAttribute('data-marquee-started', '');
      target.toggleAttribute('data-marquee-visible', isIntersecting);
    }
  });
  tracks.forEach((track) => marqueeVisibility.observe(track));
  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      const heading = target.matches(repeat);
      const feature = target.matches('[data-feature-card]');
      const experience = target.matches('[data-experience-card]');
      const about = target.matches('[data-about-reveal]');
      const distance = heading ? 60 : feature || experience ? 24 : about ? 13 : 20;
      const opacity = heading ? 0 : about || experience ? .65 : 1;
      const lines = target.querySelectorAll('[data-contact-line]');
      const items = lines.length ? [...lines] : [experience && target.firstElementChild ? target.firstElementChild : target];
      for (const [index, item] of items.entries()) {
        active.get(item)?.cancel();
        const animation = item.animate(
          [{ transform: `translateY(${distance}px)`, opacity }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: heading ? 900 : 700, delay: index * 100, easing: ease },
        );
        active.set(item, animation);
        animation.onfinish = () => active.delete(item);
      }
      if (!heading) observer.unobserve(target);
    }
  }, { rootMargin: '0px 0px -6% 0px' });

  root.querySelectorAll('[data-reveal], [data-about-reveal], [data-feature-card], [data-experience-card], [data-heading-reveal]')
    .forEach((element) => observer.observe(element));
  const contact = document.getElementById('contact-title');
  if (contact) observer.observe(contact);
  return () => {
    observer.disconnect();
    marqueeVisibility.disconnect();
    for (const track of tracks) {
      track.removeAttribute('data-marquee-started');
      track.removeAttribute('data-marquee-visible');
    }
    for (const animation of active.values()) animation.cancel();
  };
}

export default function HomeMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-home]');
    const sequence = root?.querySelector<HTMLElement>('[data-hero-sequence]');
    const hero = root?.querySelector<HTMLElement>('[data-hero]');
    const canvas = root?.querySelector<HTMLCanvasElement>('[data-home-particles]');
    const stage = root?.querySelector<HTMLElement>('[data-globe-transition]');
    const about = root?.querySelector<HTMLElement>('[data-about-intro]');
    const pin = stage?.querySelector<HTMLElement>('[data-globe-pin]');
    const globe = pin?.querySelector<HTMLElement>('[data-globe-stage]');
    if (!root || !sequence || !hero || !canvas || !stage || !about || !pin || !globe) return;

    const preference = matchMedia('(prefers-reduced-motion: no-preference)');
    const desktop = matchMedia('(min-width: 1100px) and (min-height: 720px)');
    const header = document.querySelector<HTMLElement>('[data-site-header]');
    const timeline = root.querySelector<HTMLElement>('[data-timeline]');
    const line = timeline?.querySelector<HTMLElement>('[data-progress]');
    let cleanup: (() => void) | undefined;

    function configure() {
      cleanup?.();
      if (!preference.matches) return;
      const events = new AbortController();
      const { signal } = events;
      const stopReveals = sectionReveals(root!);
      let frame = 0, measuring = true, requested = false;
      let journey: Journey;
      let start = 0, distance = 1, timelineStart = 0, timelineLength = 1;
      let previousProgress = -1;

      function removePin() {
        stage!.removeAttribute('data-motion-pinned');
        stage!.style.removeProperty('--globe-top');
        stage!.style.removeProperty('--globe-distance');
      }

      function unavailable() {
        journey = undefined;
        removePin();
        sequence!.setAttribute('data-unpinned', '');
        measuring = true;
        schedule();
      }

      async function prepare() {
        if (requested || signal.aborted) return;
        requested = true;
        try {
          const { mountHomeParticles } = await import('@/lib/homeParticles');
          if (signal.aborted) return;
          journey = await mountHomeParticles(root!, canvas!, signal, unavailable);
          if (signal.aborted) return;
          if (!journey) { unavailable(); return; }
          measuring = true;
          schedule();
        } catch {
          if (!signal.aborted) unavailable();
        }
      }

      function update() {
        frame = 0;
        const scroll = scrollY;
        const height = innerHeight;
        if (measuring) {
          measuring = false;
          const headerHeight = header?.offsetHeight ?? 0;
          const heroPinned = desktop.matches && hero!.offsetHeight + headerHeight <= height + 2;
          if (journey || !heroPinned) sequence!.toggleAttribute('data-unpinned', !heroPinned || !journey && requested);
          sequence!.style.setProperty('--pin-top', `${headerHeight}px`);
          if (journey) {
            const stageTop = stage!.getBoundingClientRect().top + scroll;
            const globeBox = globe!.getBoundingClientRect();
            const globeCenter = stageTop + globeBox.top - pin!.getBoundingClientRect().top + globeBox.height / 2;
            const anchor = about!.getBoundingClientRect().top + scroll - headerHeight;
            start = Math.min(stageTop - headerHeight + 12, Math.max(anchor + height * .025, globeCenter - height * .4));
            distance = height * (innerWidth <= 850 ? 1.5 : 1.75);
            stage!.style.setProperty('--globe-top', `${stageTop - start}px`);
            stage!.style.setProperty('--globe-distance', `${distance}px`);
            stage!.setAttribute('data-motion-pinned', '');
            journey.measure();
          }
          if (timeline) {
            const bounds = timeline.getBoundingClientRect();
            timelineStart = bounds.top + scroll - height * .8;
            timelineLength = Math.max(1, bounds.height + height * .13);
          }
        }
        if (scroll > 0 && !requested) void prepare();
        journey?.update(scroll, Math.min(1, Math.max(0, (scroll - start) / distance)));
        const progress = Math.min(1, Math.max(0, (scroll - timelineStart) / timelineLength));
        if (line && previousProgress !== progress) {
          previousProgress = progress;
          line.style.transform = `scaleY(${progress})`;
        }
      }

      function schedule() {
        if (!frame) frame = requestAnimationFrame(update);
      }
      const geometry = new ResizeObserver(() => {
        measuring = true;
        schedule();
      });
      geometry.observe(root!);
      geometry.observe(pin!);
      if (header) geometry.observe(header);
      window.addEventListener('scroll', schedule, { passive: true, signal });
      window.addEventListener('resize', () => { measuring = true; schedule(); }, { passive: true, signal });
      schedule();
      // Warm a small module between frames. Uploads and shader compilation begin at the first scroll.
      const warmup = 'requestIdleCallback' in window
        ? window.requestIdleCallback(() => { void import('@/lib/homeParticles').catch(() => {}); }) : undefined;

      cleanup = () => {
        events.abort();
        stopReveals();
        geometry.disconnect();
        cancelAnimationFrame(frame);
        if (warmup !== undefined) window.cancelIdleCallback(warmup);
        removePin();
        sequence!.removeAttribute('data-unpinned');
        sequence!.style.removeProperty('--pin-top');
        line?.style.removeProperty('transform');
      };
    }

    configure();
    preference.addEventListener('change', configure);
    return () => { preference.removeEventListener('change', configure); cleanup?.(); };
  }, []);

  return <canvas className="homeParticles" data-home-particles aria-hidden="true" />;
}
