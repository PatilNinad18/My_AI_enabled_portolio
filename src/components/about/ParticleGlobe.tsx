import styles from '@/styles/about.module.scss';

export default function ParticleGlobe() {
  return (
    <div className={styles.globe} aria-hidden="true">
      <div className={styles.globeViewport} data-globe-stage>
        <div className={styles.globeFallback} data-globe-fallback />
      </div>
    </div>
  );
}
