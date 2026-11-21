'use client';

import { useEffect, useRef, useState } from 'react';
import styles from '@/styles/assistant.module.scss';

const scene = 'https://my.spline.design/genkubgreetingrobot-43G3CMxy8nKLssEhsHTMdTs6/';

export default function RobotScene() {
  const [status, setStatus] = useState<'initial' | 'loading' | 'slow' | 'ready' | 'error'>('initial');
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = surface.current;
    if (!stage) return;
    let idle: number | undefined;
    let frame = 0;
    let timer = 0;
    const loadScene = () => {
      setStatus('loading');
      timer = window.setTimeout(() => setStatus((current) => current === 'loading' ? 'slow' : current), 12_000);
    };
    const visibility = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || document.hidden) return;
      visibility.disconnect();
      // Let the visible heading and composer paint before attaching the third-party scene.
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(loadScene, { timeout: 700 });
      else frame = requestAnimationFrame(loadScene);
    });
    visibility.observe(stage);
    const resume = () => {
      if (!document.hidden && idle === undefined && !frame && !timer) {
        visibility.unobserve(stage);
        visibility.observe(stage);
      }
    };
    document.addEventListener('visibilitychange', resume);
    return () => {
      visibility.disconnect();
      document.removeEventListener('visibilitychange', resume);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  const loadingMessage = status === 'error'
    ? 'The robot is unavailable here. Try opening the scene directly.'
    : status === 'slow' ? 'The robot is taking longer to load. You can open the scene directly.' : 'Loading the robot…';

  return (
    <div className={styles.scene} ref={surface}>
      <div className={styles.sceneLight} aria-hidden="true" />
      {status !== 'initial' && <iframe title="Interactive Spline greeting robot" src={scene} loading="lazy"
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
