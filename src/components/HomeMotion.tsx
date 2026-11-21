'use client';

import { useEffect } from 'react';

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

    const preference = window.matchMedia('(prefers-reduced-motion: no-preference)');
    let dispose: (() => void) | undefined;
    let generation = 0;

    const configure = () => {
      const current = ++generation;
      dispose?.();
      dispose = undefined;
      if (!preference.matches) return;
      void Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('@/lib/homeParticles')])
        .then(async ([{ gsap }, { ScrollTrigger }, { mountHomeParticles }]) => {
          if (current !== generation) return;
          gsap.registerPlugin(ScrollTrigger);

          const portrait = new AbortController();
          dispose = () => portrait.abort();
          const journey = await mountHomeParticles(root, canvas, portrait.signal).catch(() => undefined);
          if (current !== generation) return;

          const header = document.querySelector('[data-site-header]');
          const desktop = window.matchMedia('(min-width: 1100px) and (min-height: 720px) and (scripting: enabled)');
          let headerHeight = 0;
          const measure = () => {
            headerHeight = header?.getBoundingClientRect().height ?? 0;
            const fits = hero.offsetHeight + headerHeight <= window.innerHeight + 2;
            const pinned = desktop.matches && fits;
            sequence.toggleAttribute('data-pinned', pinned);
            sequence.toggleAttribute('data-unpinned', !pinned);
            sequence.style.setProperty('--pin-top', `${headerHeight}px`);
          };
          if (journey) measure();
          else sequence.setAttribute('data-unpinned', '');

          const context = gsap.context((scope) => {
            gsap.from('[data-hero-line]', { y: 22, duration: .85, stagger: .095, ease: 'power3.out' });
            if (journey) {
              const formation = { progress: 0 };
              gsap.to(formation, {
                progress: 1,
                ease: 'none',
                onUpdate: () => journey.setNetwork(formation.progress),
                scrollTrigger: {
                  trigger: stage,
                  pin,
                  pinSpacing: true,
                  scrub: true,
                  start: () => {
                    const stageTop = stage.getBoundingClientRect().top + window.scrollY;
                    const bounds = globe.getBoundingClientRect();
                    const globeCenter = stageTop + bounds.top - pin.getBoundingClientRect().top + bounds.height / 2;
                    // The About anchor reveals the intact globe before the pin takes over.
                    const anchorScroll = about.getBoundingClientRect().top + window.scrollY - headerHeight;
                    return Math.min(stageTop - headerHeight + 12, Math.max(anchorScroll + innerHeight * .025, globeCenter - innerHeight * .4));
                  },
                  end: () => `+=${innerHeight * (innerWidth <= 850 ? 1.5 : 1.75)}`,
                },
              });
              ScrollTrigger.create({
                start: 0,
                end: () => Math.max(1, document.documentElement.scrollHeight - innerHeight),
                onUpdate: (trigger) => journey.update(trigger.scroll()),
                onRefreshInit: measure,
                onRefresh: (trigger) => {
                  journey.measure();
                  journey.update(trigger.scroll());
                },
              });
            }
            gsap.fromTo('[data-scroll-line]', { scaleY: .55 }, {
              scaleY: 1, repeat: 2, yoyo: true, duration: .85, ease: 'sine.inOut',
            });
            ScrollTrigger.batch(root.querySelectorAll<HTMLElement>('[data-reveal]'), {
              start: 'top 92%',
              once: true,
              onEnter: (items) => {
                scope.add(() => {
                  gsap.fromTo(items, { y: 20 }, {
                    y: 0, duration: .7, stagger: .085, ease: 'power3.out', clearProps: 'transform',
                  });
                });
              },
            });
            root.querySelectorAll('[data-feature-grid]').forEach((grid) => {
              ScrollTrigger.batch(grid.querySelectorAll('[data-feature-card]'), {
                start: 'top 94%',
                once: true,
                batchMax: 3,
                onEnter: (cards) => {
                  scope.add(() => {
                    gsap.fromTo(cards, { y: 25, '--card-edge': .1 }, {
                      y: 0, '--card-edge': .7, duration: .68, stagger: .11, ease: 'power3.out', clearProps: 'transform',
                    });
                    const icons = cards.flatMap((card) => Array.from(card.querySelectorAll('[data-feature-icon]')));
                    gsap.fromTo(icons, { scale: .86, y: 4 }, {
                      scale: 1, y: 0, duration: .53, delay: .08, stagger: .11, ease: 'power2.out', clearProps: 'transform',
                    });
                  });
                },
              });
            });
            root.querySelectorAll<HTMLElement>('[data-project-image]').forEach((item) => {
              gsap.from(item.children, {
                y: 14, duration: .65, stagger: .09, ease: 'power3.out', clearProps: 'transform',
                scrollTrigger: { trigger: item, start: 'top 93%', once: true },
              });
            });
            gsap.fromTo('[data-progress]', { scaleY: 0 }, {
              scaleY: 1,
              ease: 'none',
              scrollTrigger: { trigger: '[data-timeline]', start: 'top 80%', end: 'bottom 67%', scrub: true },
            });
            ScrollTrigger.batch(root.querySelectorAll('[data-experience-card]'), {
              start: 'top 90%',
              once: true,
              onEnter: (cards) => {
                scope.add(() => {
                  gsap.fromTo(cards.map((item) => item.firstElementChild), { y: 24, opacity: .63 }, {
                    y: 0, opacity: 1, duration: .72, stagger: .14, ease: 'power3.out', clearProps: 'transform,opacity',
                  });
                });
              },
            });
            const headings = Array.from(root.querySelectorAll<HTMLElement>('[data-heading-reveal]'));
            const contactTitle = document.getElementById('contact-title');
            if (contactTitle) headings.push(contactTitle);
            for (const heading of headings) {
              const lines = heading.querySelectorAll('[data-contact-line]');
              gsap.fromTo(lines.length ? lines : heading, { y: 60, opacity: 0 }, {
                y: 0, opacity: 1, duration: .95, stagger: .12, ease: 'power3.out',
                immediateRender: true,
                scrollTrigger: {
                  trigger: heading, start: 'top bottom', end: 'bottom top',
                  toggleActions: 'play complete play reverse',
                },
              });
            }
          }, root);
          ScrollTrigger.refresh();
          ScrollTrigger.update();
          let refreshFrame = 0;
          const geometry = new ResizeObserver(() => {
            cancelAnimationFrame(refreshFrame);
            refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
          });
          geometry.observe(root);
          if (journey) geometry.observe(hero);
          if (journey) geometry.observe(pin);
          if (header) geometry.observe(header);

          dispose = () => {
            cancelAnimationFrame(refreshFrame);
            geometry.disconnect();
            portrait.abort();
            context.revert();
            sequence.removeAttribute('data-pinned');
            sequence.removeAttribute('data-unpinned');
            sequence.style.removeProperty('--pin-top');
          };
        }).catch(() => {
          if (current === generation) {
            dispose?.();
            sequence.setAttribute('data-unpinned', '');
          }
        });
    };

    configure();
    preference.addEventListener('change', configure);
    return () => {
      generation++;
      preference.removeEventListener('change', configure);
      dispose?.();
    };
  }, []);

  return <canvas className="homeParticles" data-home-particles aria-hidden="true" />;
}
