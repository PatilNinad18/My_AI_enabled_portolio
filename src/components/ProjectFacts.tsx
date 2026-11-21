'use client';

import { useState } from 'react';
import type { Project } from '@/content/projects';
import styles from '@/styles/projects.module.scss';

function DemoCredential({ label, value }: { label: 'Email' | 'Password'; value: string }) {
  const [status, setStatus] = useState<'ready' | 'copied' | 'failed'>('ready');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className={styles.demoCredential}>
      <dt>{label}</dt>
      <dd>
        <code>{value}</code>
        <button type="button" onClick={copy} aria-label={`Copy demo ${label.toLowerCase()}`}>
          {status === 'copied' ? 'Copied' : 'Copy'}
        </button>
        <span role="status" className={status === 'failed' ? styles.copyFeedback : styles.srOnly}>
          {status === 'copied' && `${label} copied.`}
          {status === 'failed' && `Couldn’t copy. Select and copy the ${label.toLowerCase()}.`}
        </span>
      </dd>
    </div>
  );
}

export default function ProjectFacts({ project }: { project: Project }) {
  const highlights = (
    <details className={styles.highlights}>
      <summary>Technical highlights<span className={styles.srOnly}> for {project.name}</span></summary>
      <ul>{project.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
    </details>
  );

  return (
    <>
      <p>{project.description}</p>
      <ul className={styles.tags} aria-label="Technology stack">{project.stack.map((tool) => <li key={tool}>{tool}</li>)}</ul>
      {project.status && <p className={styles.status}>{project.status}</p>}
      {(project.repository || project.demo) && (
        <div className={styles.projectLinks}>
          {project.repository && (
            <a href={project.repository} target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span><span className={styles.srOnly}> for {project.name}</span></a>
          )}
          {project.demo && (
            <a href={project.demo} target="_blank" rel="noopener noreferrer">Live Demo <span aria-hidden="true">↗</span><span className={styles.srOnly}> for {project.name}</span></a>
          )}
        </div>
      )}
      {project.demo && project.demoAccess ? (
        <div className={styles.demoLayout} data-project-demo-layout>
          {highlights}
          <section className={styles.demoAccess} aria-label={`Demo access for ${project.name}`}>
            <h4>Demo Access</h4>
            <dl>
              <DemoCredential label="Email" value={project.demoAccess.email} />
              <DemoCredential label="Password" value={project.demoAccess.password} />
            </dl>
            <a className={styles.demoLaunch} href={project.demo} target="_blank" rel="noopener noreferrer">
              Try Live Demo <span aria-hidden="true">↗</span>
            </a>
          </section>
        </div>
      ) : highlights}
    </>
  );
}
