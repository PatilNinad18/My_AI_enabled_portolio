'use client';

import { useState } from 'react';
import styles from '@/styles/about.module.scss';

const disciplines = [
  { label: 'Engineer', description: 'Engineering foundations in electronics, telecommunications, and full-stack software development.' },
  { label: 'Build', description: 'Independent products like TimeBoard and Fieldora, built around everyday problems.' },
  { label: 'Explore', description: 'Applied AI, machine learning, computer vision, and interactive 3D experiences.' },
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
