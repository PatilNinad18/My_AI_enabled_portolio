import Image from 'next/image';
import styles from '@/styles/about.module.scss';

export default function ParticleGlobe() {
  return (
    <div className={styles.globe} aria-hidden="true">
      <div className={styles.globeViewport} data-globe-stage>
        <Image className={styles.globeFallback} data-globe-fallback alt="" fill unoptimized
          src="/images/about-constellation-preview.webp" loading="lazy" />
      </div>
    </div>
  );
}
