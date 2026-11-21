'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { screenshotManifest } from '@/content/assetPaths';
import type { Project } from '@/content/projects';

export function useProjectScreenshots() {
  const [available, setAvailable] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const request = new AbortController();
    void fetch(screenshotManifest, { signal: request.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const paths: string[] = await response.json();
        if (!request.signal.aborted) setAvailable(new Set(paths));
      })
      .catch(() => {
        // Keep the existing placeholders if the availability check fails.
      });
    return () => request.abort();
  }, []);

  return available;
}

export default function ProjectScreenshot({ project, available, placeholderClass }: {
  project: Project;
  available: boolean;
  placeholderClass?: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  return (
    <>
      {available && status !== 'failed' && (
        <Image fill unoptimized src={project.screenshot} alt={`Screenshot of ${project.name}`}
          onLoad={() => setStatus('ready')} onError={() => setStatus('failed')}
          style={{ objectFit: 'contain', visibility: status === 'ready' ? 'visible' : 'hidden' }} />
      )}
      {status !== 'ready' && <span className={placeholderClass}>Screenshot pending</span>}
    </>
  );
}
