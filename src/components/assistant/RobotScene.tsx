'use client';

import { useEffect, useState } from 'react';
import styles from '@/styles/assistant.module.scss';

const scene = 'https://my.spline.design/genkubgreetingrobot-43G3CMxy8nKLssEhsHTMdTs6/';

export default function RobotScene() {
  const [status, setStatus] = useState<'initial' | 'loading' | 'slow' | 'ready' | 'error'>('initial');

  useEffect(() => {
    // Attach load handlers before starting the iframe request, including on cached reloads.
    const frame = requestAnimationFrame(() => setStatus('loading'));
    const timer = window.setTimeout(() => setStatus((current) => current === 'loading' ? 'slow' : current), 12_000);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, []);

  const loadingMessage = status === 'error'
    ? 'The robot is unavailable here. Try opening the scene directly.'
    : status === 'slow' ? 'The robot is taking longer to load. You can open the scene directly.' : 'Loading the robot…';

  return (
    <div className={styles.scene}>
      <div className={styles.sceneLight} aria-hidden="true" />
      {status !== 'initial' && <iframe title="Interactive Spline greeting robot" src={scene}
        referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        data-loaded={status === 'ready' || undefined} onLoad={() => setStatus('ready')} onError={() => setStatus('error')} />}
      <div className={styles.sceneTools}>
        <a href={scene} target="_blank" rel="noopener noreferrer" aria-label="Open interactive 3D scene in a new tab">
          <span className={styles.signal} aria-hidden="true" /> 3D scene <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className={styles.sceneLabels} aria-hidden="true">
        <span>Engineer</span><span>Build</span><span>Explore</span>
      </div>
      {status !== 'ready' && (
        <div className={styles.sceneFallback} role="status">
          <span aria-hidden="true" />
          {loadingMessage}
        </div>
      )}
    </div>
  );
}
