'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import styles from '@/styles/navigation.module.scss';

const links = [
  ['home', 'Home'], ['about', 'About'], ['projects', 'Work'], ['contact', 'Contact'],
] as const;
type Section = (typeof links)[number][0];
type NavigateEvent = Parameters<NonNullable<ComponentProps<typeof Link>['onNavigate']>>[0];
type Navigate = (section: Section, event: NavigateEvent) => void;
const nearTop = 48;
const scrollThreshold = 8;

function RouteLinks({ activeHref, navigate, closeMenu }: {
  activeHref: string;
  navigate: Navigate;
  closeMenu?: () => void;
}) {
  return (
    <>
      {links.map(([section, label]) => (
        <Link key={section} href={`/#${section}`} scroll={false} prefetch={false}
          aria-current={activeHref === `/#${section}` ? 'location' : undefined}
          onNavigate={(event) => navigate(section, event)}>
          <span data-lift>{label}</span>
        </Link>
      ))}
      <Link href="/assistant" prefetch={false} target="_blank" rel="noopener noreferrer"
        aria-current={activeHref === '/assistant' ? 'page' : undefined} onClick={closeMenu}>
        <span data-lift>AI</span><span className={styles.srOnly}> (opens in a new tab)</span>
      </Link>
    </>
  );
}

function ContactLink({ navigate }: { navigate: Navigate }) {
  return (
    <Link href="/#contact" scroll={false} prefetch={false} className={styles.contact} onNavigate={(event) => navigate('contact', event)}>
      <span data-lift>Let’s Connect <span aria-hidden="true">↗</span></span>
    </Link>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const panelId = useId();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>('home');
  const open = openPath === pathname;
  const activeHref = pathname === '/' ? `/#${activeSection}` : pathname;
  const header = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const linksRegion = useRef<HTMLElement>(null);
  const slider = useRef<HTMLSpanElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const destination = useRef<Section | null>(null);
  const stopAnchorMotion = useRef<(() => void) | null>(null);
  const anchorUntil = useRef(0);
  const revealNavbar = useRef<(() => void) | null>(null);

  const scrollToSection = useCallback((section: Section) => {
    stopAnchorMotion.current?.();
    const target = document.getElementById(section);
    if (!target) return;
    revealNavbar.current?.();
    target.focus({ preventScroll: true });

    const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const inset = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const top = () => Math.max(0, window.scrollY + target.getBoundingClientRect().top - inset);
    const startY = window.scrollY;
    const distance = Math.abs(top() - startY);
    if (!motion.matches || distance < 2) {
      anchorUntil.current = performance.now() + 150;
      window.scrollTo({ top: top(), behavior: 'instant' });
      return;
    }

    const events = new AbortController();
    const startTime = performance.now();
    const duration = Math.min(850, 400 + distance * .075);
    let frame = 0;
    const stop = () => {
      events.abort();
      cancelAnimationFrame(frame);
      stopAnchorMotion.current = null;
    };
    stopAnchorMotion.current = stop;
    const step = (now: number) => {
      const progress = motion.matches ? Math.min((now - startTime) / duration, 1) : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      // The particle pins can change the destination's document position during navigation.
      window.scrollTo({ top: startY + (top() - startY) * eased, behavior: 'instant' });
      if (progress < 1) frame = requestAnimationFrame(step);
      else {
        anchorUntil.current = now + 150;
        stop();
      }
    };
    const options = { passive: true, signal: events.signal };
    window.addEventListener('wheel', stop, options);
    window.addEventListener('pointerdown', stop, options);
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Tab', ' '].includes(event.key)) stop();
    }, options);
    frame = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => stopAnchorMotion.current?.(), [pathname]);

  const navigate: Navigate = (section, event) => {
    setOpenPath(null);
    if (pathname !== '/') {
      destination.current = section;
      return;
    }

    event.preventDefault();
    const href = `/#${section}`;
    if (location.search || location.hash !== `#${section}`) window.history.pushState(null, '', href);
    scrollToSection(section);
  };

  useEffect(() => {
    if (pathname !== '/' || !destination.current) return;
    const section = destination.current;
    destination.current = null;
    if (location.hash === `#${section}`) scrollToSection(section);
  }, [pathname, scrollToSection]);

  useEffect(() => {
    if (pathname !== '/') return;
    const sections = links.map(([id]) => ({ id, element: document.getElementById(id) }));
    const events = new AbortController();
    let frame = 0;
    let previous: Section | undefined;
    const update = () => {
      frame = 0;
      const readingLine = (header.current?.offsetHeight ?? 0) + 4;
      let current: Section = 'home';
      for (const { id, element } of sections) {
        if (element && element.getBoundingClientRect().top <= readingLine) current = id;
      }
      if (current !== previous) {
        previous = current;
        setActiveSection(current);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const geometry = new ResizeObserver(schedule);
    const content = document.querySelector('[data-home]');
    if (content) geometry.observe(content);
    if (header.current) geometry.observe(header.current);
    window.addEventListener('scroll', schedule, { passive: true, signal: events.signal });
    schedule();
    return () => {
      events.abort();
      cancelAnimationFrame(frame);
      geometry.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    const item = bar.current;
    const shell = header.current;
    const menuToggle = toggle.current;
    if (!item || !shell || !menuToggle) return;
    const events = new AbortController();
    const motion = matchMedia('(prefers-reduced-motion: no-preference)');
    const hover = matchMedia('(hover: hover)');
    let lastY = Math.max(0, scrollY);
    let frame = 0;

    const reveal = () => {
      lastY = Math.max(0, scrollY);
      shell.removeAttribute('data-nav-hidden');
    };
    revealNavbar.current = reveal;
    function update() {
      frame = 0;
      const y = Math.max(0, scrollY);
      shell!.toggleAttribute('data-nav-scrolled', y > 30);
      const focused = document.activeElement;
      const keyboardFocus = shell!.contains(focused) && focused?.matches(':focus-visible');
      if (!motion.matches || y <= nearTop || stopAnchorMotion.current || performance.now() < anchorUntil.current
        || keyboardFocus || menuToggle!.getAttribute('aria-expanded') === 'true' || (hover.matches && item!.matches(':hover'))) {
        reveal();
        return;
      }
      if (Math.abs(y - lastY) < scrollThreshold) return;
      shell!.toggleAttribute('data-nav-hidden', y > lastY);
      lastY = y;
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    window.addEventListener('scroll', schedule, { passive: true, signal: events.signal });
    motion.addEventListener('change', schedule, { signal: events.signal });
    shell.addEventListener('focusin', (event) => {
      if (event.target instanceof Element && event.target.matches(':focus-visible')) reveal();
    }, { signal: events.signal });
    schedule();
    return () => {
      events.abort();
      cancelAnimationFrame(frame);
      revealNavbar.current = null;
      shell.removeAttribute('data-nav-hidden');
      shell.removeAttribute('data-nav-scrolled');
    };
  }, []);

  useEffect(() => {
    const menu = linksRegion.current;
    const marker = slider.current;
    const active = menu?.querySelector<HTMLElement>('[aria-current]');
    if (!menu || !marker || !active) {
      menu?.removeAttribute('data-marker-ready');
      return;
    }
    const position = () => {
      const x = active.offsetLeft;
      const width = active.offsetWidth;
      marker.style.transform = `translateX(${x}px)`;
      marker.style.width = `${width}px`;
      menu.setAttribute('data-marker-ready', '');
    };
    position();
    const geometry = new ResizeObserver(position);
    geometry.observe(menu);
    return () => geometry.disconnect();
  }, [activeHref]);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia('(min-width: 801px)');
    const events = new AbortController();
    panel.current?.querySelector('a')?.focus();
    const close = () => setOpenPath(null);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      close();
      toggle.current?.focus();
    }, { signal: events.signal });
    document.addEventListener('pointerdown', (event) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) close();
    }, { signal: events.signal });
    desktop.addEventListener('change', close, { signal: events.signal });
    return () => events.abort();
  }, [open]);

  return (
    <header className={styles.header} data-site-header ref={header}>
      <div className={styles.bar} ref={bar}>
        <Link className={styles.wordmark} href="/#home" scroll={false} prefetch={false} aria-label="Ninad Patil home"
          onNavigate={(event) => navigate('home', event)}>
          Ninad Patil<span>.</span>
        </Link>
        <nav className={styles.links} aria-label="Main navigation" ref={linksRegion}>
          <span className={styles.marker} aria-hidden="true" ref={slider} />
          <RouteLinks activeHref={activeHref} navigate={navigate} />
        </nav>
        <div className={styles.desktopContact}><ContactLink navigate={navigate} /></div>
        <button ref={toggle} type="button" className={styles.toggle} aria-expanded={open} aria-controls={panelId}
          onClick={() => setOpenPath(open ? null : pathname)}>
          {open ? 'Close' : 'Menu'}
          <span className={styles.menuIcon} aria-hidden="true" />
        </button>
        <nav id={panelId} className={styles.panel} aria-label="Main navigation" ref={panel} hidden={!open}>
          <RouteLinks activeHref={activeHref} navigate={navigate} closeMenu={() => setOpenPath(null)} />
          <ContactLink navigate={navigate} />
        </nav>
      </div>
    </header>
  );
}
