'use client';

import { useId, useState, type PointerEvent } from 'react';
import ProjectFacts from '@/components/ProjectFacts';
import ProjectFilters from '@/components/ProjectFilters';
import ProjectScreenshot, { useProjectScreenshots } from '@/components/ProjectScreenshot';
import { projects, type Category } from '@/content/projects';
import styles from '@/styles/projects.module.scss';

function tilt(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  card.style.setProperty('--rx', `${(0.5 - y) * 4}deg`);
  card.style.setProperty('--ry', `${(x - 0.5) * 4}deg`);
  card.style.setProperty('--x', `${x * 100}%`);
  card.style.setProperty('--y', `${y * 100}%`);
}

export default function ProjectGrid() {
  const [selected, setSelected] = useState<Category>('Full-Stack');
  const resultsId = useId();
  const screenshots = useProjectScreenshots();

  return (
    <div className={styles.work}>
      <ProjectFilters selected={selected} onSelect={setSelected} resultsId={resultsId} />
      <div id={resultsId} key={selected} className={styles.results}>
        <section className={styles.category}>
          <h2 className={styles.categoryHeading}>{selected}</h2>
          <div className={styles.grid}>
            {projects[selected].map((project, index) => (
              <div className={styles.frame} key={project.name} data-reveal>
                <article className={styles.card} onPointerMove={tilt}>
                  <div className={styles.preview} data-project-image>
                    <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <ProjectScreenshot project={project} available={screenshots.has(project.screenshot)} placeholderClass={styles.placeholder} />
                  </div>
                  <div className={styles.copy}>
                    <p className={styles.label}>{selected}</p>
                    <h3 className={styles.projectHeading}>{project.name}</h3>
                    <ProjectFacts project={project} />
                  </div>
                </article>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
