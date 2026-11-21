'use client';

import { useState } from 'react';
import styles from '@/styles/about.module.scss';

const disciplines = [
  { label: 'Engineer', description: 'Strong foundations in programming, software development, problem-solving, and system design.' },
  { label: 'Build', description: 'Turning ideas into functional applications through frontend, backend, databases, and AI integration.' },
  { label: 'Explore', description: 'Experimenting with emerging technologies, LLMs, computer vision, automation, and independent product ideas..' },
] as const;

export default function DisciplineSelector() {
  const [selected, setSelected] = useState(0);
  return (
    <div className={styles.disciplines}>
      <div className={styles.disciplineControls} role="group" aria-label="Three disciplines">
        {disciplines.map(({ label }, index) => (
          <button key={label} type="button" aria-pressed={index === selected}
            aria-controls="discipline-description" onClick={() => setSelected(index)}>
            {label}
          </button>
        ))}
      </div>
      <p id="discipline-description" aria-live="polite">{disciplines[selected].description}</p>
    </div>
  );
}
