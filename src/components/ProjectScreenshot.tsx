'use client';

import Image from 'next/image';
import { useEffect, useState, type RefObject } from 'react';
import { screenshotManifest } from '@/content/assetPaths';
import type { Project } from '@/content/projects';

export function useProjectScreenshots(region: RefObject<HTMLElement | null>) {
  const [available, setAvailable] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const request = new AbortController();
    const nearby = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      nearby.disconnect();
      void fetch(screenshotManifest, { signal: request.signal, cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) return;
          const paths: string[] = await response.json();
          if (!request.signal.aborted) setAvailable(new Set(paths));
        })
        .catch(() => {
          // Keep the existing placeholders if the availability check fails.
        });
    }, { rootMargin: '650px 0px' });
    nearby.observe(element);
    return () => { nearby.disconnect(); request.abort(); };
  }, [region]);

  return available;
}

export default function ProjectScreenshot({ project, available, placeholderClass, sizes }: {
  project: Project;
  available: boolean;
  placeholderClass?: string;
  sizes: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  return (
    <>
      {available && status !== 'failed' && (
        <Image fill loading="lazy" sizes={sizes} src={project.screenshot} alt={`Screenshot of ${project.name}`}
          onLoad={() => setStatus('ready')} onError={() => setStatus('failed')}
          style={{ objectFit: 'contain', visibility: status === 'ready' ? 'visible' : 'hidden' }} />
      )}
      {status !== 'ready' && <span className={placeholderClass}>Screenshot pending</span>}
    </>
  );
}
