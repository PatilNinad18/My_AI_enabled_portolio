'use client';

import { useEffect, useId, useRef, useSyncExternalStore, type PointerEvent } from 'react';
import ProjectFacts from '@/components/ProjectFacts';
import ProjectFilters from '@/components/ProjectFilters';
import ProjectScreenshot, { useProjectScreenshots } from '@/components/ProjectScreenshot';
import { projects, type Category } from '@/content/projects';
import styles from '@/styles/projectShowcase.module.scss';

const defaultCategory: Category = 'Full-Stack';
let selectedCategory: Category = defaultCategory;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSelection() { return selectedCategory; }
function getInitialSelection() { return defaultCategory; }

function select(category: Category) {
  if (selectedCategory === category) return;
  selectedCategory = category;
  listeners.forEach((listener) => listener());
}

function moveQuoteHighlight(event: PointerEvent<HTMLQuoteElement>) {
  if (event.pointerType !== 'mouse') return;

  const quote = event.currentTarget;
  const bounds = quote.getBoundingClientRect();
  quote.style.setProperty('--quote-x', `${event.clientX - bounds.left}px`);
  quote.style.setProperty('--quote-y', `${event.clientY - bounds.top}px`);
  if (!quote.hasAttribute('data-quote-hover')) quote.setAttribute('data-quote-hover', '');
}

export default function ProjectShowcase() {
  const selected = useSyncExternalStore(subscribe, getSelection, getInitialSelection);
  const previous = useRef(selected);
  const resultsId = useId();
  const section = useRef<HTMLElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const visible = projects[selected];
  const screenshots = useProjectScreenshots(section);

  useEffect(() => {
    if (previous.current === selected) return;
    previous.current = selected;
    const scope = results.current;
    if (!scope || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    let disposed = false;
    let revert: (() => void) | undefined;
    void import('gsap').then(({ gsap }) => {
      if (disposed) return;
      const context = gsap.context(() => {
        gsap.from(scope.querySelectorAll('[data-project-row]'), {
          y: 17, opacity: .68, duration: .39, ease: 'power2.out', stagger: { amount: .22 },
          clearProps: 'transform,opacity',
        });
      }, scope);
      revert = () => context.revert();
    }).catch(() => {});
    return () => { disposed = true; revert?.(); };
  }, [selected]);

  return (
    <section id="projects" ref={section} className={styles.section} aria-labelledby="home-work" tabIndex={-1}>
      <header className={styles.intro}>
        <h2 id="home-work" className={styles.title} data-heading-reveal>My Projects</h2>
        <blockquote className={styles.quote} data-reveal onPointerMove={moveQuoteHighlight}
          onPointerLeave={(event) => event.currentTarget.removeAttribute('data-quote-hover')}>
          <span>Even if you&apos;re building the product for yourself, listen to outside users — they&apos;ll tell you how to make </span><em>a product they&apos;ll pay for</em>
        </blockquote>
      </header>
      <ProjectFilters selected={selected} onSelect={select} resultsId={resultsId} />
      <p className={styles.srOnly} role="status">{visible.length} projects shown</p>
      <div id={resultsId} ref={results}>
        {visible.map((project, index) => (
          <article className={styles.row} key={project.name} data-project-row>
            <div className={styles.frame}>
              <div className={styles.chrome}>
                <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
                <span>{project.name}</span>
              </div>
              <div className={styles.preview}>
                <div className={styles.previewSurface}>
                  <ProjectScreenshot project={project} available={screenshots.has(project.screenshot)}
                    sizes="(max-width: 770px) 90vw, (max-width: 1550px) 45vw, 700px" />
                </div>
              </div>
            </div>
            <div className={styles.copy}>
              <p className={styles.meta}><span>{String(index + 1).padStart(2, '0')}</span> <span aria-hidden="true">/</span> {selected}</p>
              <h3>{project.name}</h3>
              <ProjectFacts project={project} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
